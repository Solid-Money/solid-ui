import { ADDRESSES } from "@/lib/config";
import { TokenBalance } from "@/lib/types";
import { isSoUSDToken } from "@/lib/utils";
import { publicClient } from "@/lib/wagmi";
import { useCallback, useEffect, useRef, useState } from "react";
import { readContract } from "viem/actions";
import { mainnet } from "viem/chains";
import useUser from "./useUser";

// Blockscout response structure for both Ethereum and Fuse
interface BlockscoutTokenBalance {
  token: {
    address: string;
    address_hash: string;
    circulating_market_cap?: string;
    decimals: string;
    exchange_rate?: string;
    holders?: string;
    holders_count?: string;
    icon_url?: string;
    is_bridged?: boolean;
    name: string;
    symbol: string;
    total_supply?: string;
    type: string;
    volume_24h?: string;
  };
  token_id: null;
  token_instance: null;
  value: string;
}

type BlockscoutResponse = BlockscoutTokenBalance[];

type CalculatedTokenValue = {
  soUSDValue: number;
  regularValue: number;
  value: number;
}

interface BalanceData {
  totalUSD: number;
  totalSoUSD: number;
  totalUSDExcludingSoUSD: number;
  soUSDEthereum: number;
  soUSDFuse: number;
  ethereumTokens: TokenBalance[];
  fuseTokens: TokenBalance[];
  tokens: TokenBalance[];
  isLoading: boolean;
  isRefreshing: boolean;
  isStale: boolean;
  error: string | null;
  refresh: () => void;
  retry: () => void;
}

interface BalanceState {
  totalUSD: number;
  totalSoUSD: number;
  totalUSDExcludingSoUSD: number;
  soUSDEthereum: number;
  soUSDFuse: number;
  ethereumTokens: TokenBalance[];
  fuseTokens: TokenBalance[];
  tokens: TokenBalance[];
  isLoading: boolean;
  isRefreshing: boolean;
  isStale: boolean;
  error: string | null;
  lastFetchTime: number | null;
  retryCount: number;
}

const CACHE_DURATION = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const STALE_TIME = 60000;

// Chain IDs
const ETHEREUM_CHAIN_ID = 1;
const FUSE_CHAIN_ID = 122;

// ABI for AccountantWithRateProviders getRate function
const ACCOUNTANT_ABI = [
  {
    inputs: [],
    name: "getRate",
    outputs: [
      {
        internalType: "uint256",
        name: "rate",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const useBalances = (): BalanceData => {
  const { user } = useUser();
  const [balanceData, setBalanceData] = useState<BalanceState>({
    totalUSD: 0,
    totalSoUSD: 0,
    totalUSDExcludingSoUSD: 0,
    soUSDEthereum: 0,
    soUSDFuse: 0,
    ethereumTokens: [],
    fuseTokens: [],
    tokens: [],
    isLoading: false,
    isRefreshing: false,
    isStale: false,
    error: null,
    lastFetchTime: null,
    retryCount: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchWithTimeout = async (url: string, timeout = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  const fetchBalances = useCallback(
    async (isLoading = "isLoading", retryAttempt = 0) => {
      if (!user?.safeAddress) {
        setBalanceData((prev) => ({
          ...prev,
          [isLoading]: false,
          error: null,
          retryCount: 0,
        }));
        return;
      }

      const now = Date.now();
      if (
        balanceData.lastFetchTime &&
        now - balanceData.lastFetchTime < CACHE_DURATION &&
        isLoading === "isRefreshing" &&
        !balanceData.error
      ) {
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setBalanceData((prev) => ({
        ...prev,
        [isLoading]: true,
        error: null,
        retryCount: retryAttempt,
      }));

      try {
        const [ethereumResponse, fuseResponse, soUSDRate] =
          await Promise.allSettled([
            fetchWithTimeout(
              `https://eth.blockscout.com/api/v2/addresses/${user?.safeAddress}/token-balances`
            ),
            fetchWithTimeout(
              `https://explorer.fuse.io/api/v2/addresses/${user?.safeAddress}/token-balances`
            ),
            readContract(publicClient(mainnet.id), {
              address: ADDRESSES.ethereum.accountant,
              abi: ACCOUNTANT_ABI,
              functionName: "getRate",
            }),
          ]);

        let ethereumTokens: TokenBalance[] = [];
        let fuseTokens: TokenBalance[] = [];
        let rate = 0;

        // Process soUSD rate
        if (soUSDRate.status === "fulfilled") {
          rate = Number(soUSDRate.value) / Math.pow(10, 6);
        } else {
          console.warn("Failed to fetch soUSD rate:", soUSDRate.reason);
        }

        // Convert Blockscout format to our standard format
        const convertBlockscoutToTokenBalance = (
          item: BlockscoutTokenBalance,
          chainId: number,
        ): TokenBalance => {
          const address = item.token.address || item.token.address_hash;
          return {
            contractTickerSymbol: item.token.symbol,
            contractName: item.token.name,
            contractAddress: address,
            balance: item.value,
            quoteRate: item.token.exchange_rate
              ? parseFloat(item.token.exchange_rate)
              : isSoUSDToken(address)
                ? rate
                : 0,
            logoUrl: item.token.icon_url,
            contractDecimals: parseInt(item.token.decimals),
            type: item.token.type,
            verified: true, // Assume verified if it's on Blockscout
            chainId: chainId,
          };
        };

        // Process Ethereum response (Blockscout)
        if (
          ethereumResponse.status === "fulfilled" &&
          ethereumResponse.value.ok
        ) {
          const ethereumData: BlockscoutResponse =
            await ethereumResponse.value.json();
          // Filter out NFTs and only include ERC-20 tokens
          const erc20Tokens = ethereumData.filter(
            (item) => item.token.type === "ERC-20",
          );
          ethereumTokens = erc20Tokens.map((item) =>
            convertBlockscoutToTokenBalance(item, ETHEREUM_CHAIN_ID),
          );
        } else if (ethereumResponse.status === "rejected") {
          console.warn(
            "Failed to fetch Ethereum balances:",
            ethereumResponse.reason,
          );
        }

        // Process Fuse response (Blockscout)
        if (fuseResponse.status === "fulfilled" && fuseResponse.value.ok) {
          const fuseData: BlockscoutResponse = await fuseResponse.value.json();
          // Filter out NFTs and only include ERC-20 tokens
          const erc20Tokens = fuseData.filter(
            (item) => item.token.type === "ERC-20",
          );
          fuseTokens = erc20Tokens.map((item) =>
            convertBlockscoutToTokenBalance(item, FUSE_CHAIN_ID),
          );
        } else if (fuseResponse.status === "rejected") {
          console.warn("Failed to fetch Fuse balances:", fuseResponse.reason);
        }

        // Calculate token values separately for soUSD and regular tokens
        const calculateTokenValue = (
          token: TokenBalance,
        ): CalculatedTokenValue => {
          if (!token.balance || !token.quoteRate)
            return { soUSDValue: 0, regularValue: 0, value: 0 };

          // Convert balance from raw format to decimal format using contractDecimals
          const formattedBalance =
            parseFloat(token.balance) / Math.pow(10, token.contractDecimals);

          const value = formattedBalance * token.quoteRate;

          if (isSoUSDToken(token.contractAddress)) {
            return { soUSDValue: value, regularValue: 0, value };
          }

          return { soUSDValue: 0, regularValue: value, value };
        };

        // Calculate totals for both chains
        const ethereumTotals = ethereumTokens.reduce(
          (acc, token) => {
            const { soUSDValue, regularValue } = calculateTokenValue(token);
            return {
              soUSD: acc.soUSD + soUSDValue,
              regular: acc.regular + regularValue,
            };
          },
          { soUSD: 0, regular: 0 },
        );

        const fuseTotals = fuseTokens.reduce(
          (acc, token) => {
            const { soUSDValue, regularValue } = calculateTokenValue(token);
            return {
              soUSD: acc.soUSD + soUSDValue,
              regular: acc.regular + regularValue,
            };
          },
          { soUSD: 0, regular: 0 },
        );

        const totalSoUSD = ethereumTotals.soUSD + fuseTotals.soUSD;
        const totalRegular = ethereumTotals.regular + fuseTotals.regular;

        const allTokens = [...ethereumTokens, ...fuseTokens]
          .sort((a, b) => {
            const aValue = calculateTokenValue(a);
            const bValue = calculateTokenValue(b);
            return bValue.value - aValue.value;
          });

        setBalanceData((prev) => ({
          ...prev,
          totalUSD: totalSoUSD + totalRegular,
          totalSoUSD,
          totalUSDExcludingSoUSD: totalRegular,
          soUSDEthereum: ethereumTotals.soUSD,
          soUSDFuse: fuseTotals.soUSD,
          ethereumTokens,
          fuseTokens,
          tokens: allTokens,
          [isLoading]: false,
          isStale: false,
          error: null,
          lastFetchTime: Date.now(),
          retryCount: 0,
        }));

        if (staleTimeoutRef.current) {
          clearTimeout(staleTimeoutRef.current);
        }
        staleTimeoutRef.current = setTimeout(() => {
          setBalanceData((prev) => ({ ...prev, isStale: true }));
        }, STALE_TIME);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.name === "AbortError"
              ? "Request cancelled"
              : error.message
            : "Failed to fetch balances";

        console.error("Error fetching balances:", error);

        if (retryAttempt < MAX_RETRIES && error instanceof Error && error.name !== "AbortError") {
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
          retryTimeoutRef.current = setTimeout(() => {
            fetchBalances(isLoading, retryAttempt + 1);
          }, RETRY_DELAY * Math.pow(2, retryAttempt));
        } else {
          setBalanceData((prev) => ({
            ...prev,
            [isLoading]: false,
            error: errorMessage,
            retryCount: retryAttempt,
          }));
        }
      }
    },
    [user?.safeAddress, balanceData.lastFetchTime],
  );

  const refresh = useCallback(() => {
    setBalanceData((prev) => ({ ...prev, lastFetchTime: null }));
    fetchBalances("isRefreshing");
  }, [fetchBalances]);

  const retry = useCallback(() => {
    setBalanceData((prev) => ({ ...prev, error: null, retryCount: 0 }));
    fetchBalances("isLoading", 0);
  }, [fetchBalances]);

  useEffect(() => {
    fetchBalances();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (staleTimeoutRef.current) {
        clearTimeout(staleTimeoutRef.current);
      }
    };
  }, [user?.safeAddress]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && balanceData.isStale) {
        refresh();
      }
    };

    const handleOnline = () => {
      if (balanceData.error) {
        retry();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [balanceData.isStale, balanceData.error, refresh, retry]);

  return {
    totalUSD: balanceData.totalUSD,
    totalSoUSD: balanceData.totalSoUSD,
    totalUSDExcludingSoUSD: balanceData.totalUSDExcludingSoUSD,
    soUSDEthereum: balanceData.soUSDEthereum,
    soUSDFuse: balanceData.soUSDFuse,
    ethereumTokens: balanceData.ethereumTokens,
    fuseTokens: balanceData.fuseTokens,
    tokens: balanceData.tokens,
    isLoading: balanceData.isLoading,
    isRefreshing: balanceData.isRefreshing,
    isStale: balanceData.isStale,
    error: balanceData.error,
    refresh,
    retry,
  };
};
