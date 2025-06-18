import { ADDRESSES } from '@/lib/config';
import { publicClient } from '@/lib/wagmi';
import { useCallback, useEffect, useState } from 'react';
import { readContract } from 'viem/actions';
import { mainnet } from 'viem/chains';
import useUser from './useUser';

interface TokenBalance {
  contractTickerSymbol: string;
  contractName: string;
  contractAddress: string;
  balance: string;
  balance24h?: string;
  quoteRate?: number;
  quote?: number;
  quote24h?: number;
  logoUrl?: string;
  contractDecimals: number;
  type: string;
  verified?: boolean;
  coinGeckoId?: string;
  chainId: number;
}

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

interface BalanceData {
  totalUSD: number;
  soUSDValue: number;
  totalUSDExcludingSoUSD: number;
  ethereumTokens: TokenBalance[];
  fuseTokens: TokenBalance[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

interface BalanceState {
  totalUSD: number;
  soUSDValue: number;
  totalUSDExcludingSoUSD: number;
  ethereumTokens: TokenBalance[];
  fuseTokens: TokenBalance[];
  isLoading: boolean;
  error: string | null;
}

// Chain IDs
const ETHEREUM_CHAIN_ID = 1;
const FUSE_CHAIN_ID = 122;

// ABI for AccountantWithRateProviders getRate function
const ACCOUNTANT_ABI = [
  {
    "inputs": [],
    "name": "getRate",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "rate",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const useBalances = (): BalanceData => {
  const { user } = useUser();
  const [balanceData, setBalanceData] = useState<BalanceState>({
    totalUSD: 0,
    soUSDValue: 0,
    totalUSDExcludingSoUSD: 0,
    ethereumTokens: [],
    fuseTokens: [],
    isLoading: false,
    error: null,
  });

  const fetchBalances = useCallback(async () => {
    if (!user?.safeAddress) {
      setBalanceData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setBalanceData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Make parallel requests to both chains and get soUSD rate
      const [ethereumResponse, fuseResponse, soUSDRate] = await Promise.allSettled([
        // Ethereum via Blockscout
        fetch(`https://eth.blockscout.com/api/v2/addresses/${user?.safeAddress}/token-balances`, {
          headers: {
            accept: 'application/json',
          },
        }),
        // Fuse via Blockscout
        fetch(`https://explorer.fuse.io/api/v2/addresses/${user?.safeAddress}/token-balances`, {
          headers: {
            accept: 'application/json',
          },
        }),
        readContract(publicClient(mainnet.id), {
          address: ADDRESSES.ethereum.accountant,
          abi: ACCOUNTANT_ABI,
          functionName: 'getRate',
        }),
      ]);

      let ethereumTokens: TokenBalance[] = [];
      let fuseTokens: TokenBalance[] = [];
      let rate = BigInt(0);

      // Convert Blockscout format to our standard format
      const convertBlockscoutToTokenBalance = (item: BlockscoutTokenBalance, chainId: number): TokenBalance => ({
        contractTickerSymbol: item.token.symbol,
        contractName: item.token.name,
        contractAddress: item.token.address,
        balance: item.value,
        quoteRate: item.token.exchange_rate ? parseFloat(item.token.exchange_rate) : 0,
        quote: 0, // Will be calculated
        logoUrl: item.token.icon_url,
        contractDecimals: parseInt(item.token.decimals),
        type: item.token.type,
        verified: true, // Assume verified if it's on Blockscout
        chainId: chainId,
      });

      // Process Ethereum response (Blockscout)
      if (ethereumResponse.status === 'fulfilled' && ethereumResponse.value.ok) {
        const ethereumData: BlockscoutResponse = await ethereumResponse.value.json();
        // Filter out NFTs and only include ERC-20 tokens
        const erc20Tokens = ethereumData.filter(item => item.token.type === 'ERC-20');
        ethereumTokens = erc20Tokens.map(item => convertBlockscoutToTokenBalance(item, ETHEREUM_CHAIN_ID));
      } else if (ethereumResponse.status === 'rejected') {
        console.warn('Failed to fetch Ethereum balances:', ethereumResponse.reason);
      }

      // Process Fuse response (Blockscout)
      if (fuseResponse.status === 'fulfilled' && fuseResponse.value.ok) {
        const fuseData: BlockscoutResponse = await fuseResponse.value.json();
        // Filter out NFTs and only include ERC-20 tokens
        const erc20Tokens = fuseData.filter(item => item.token.type === 'ERC-20');
        fuseTokens = erc20Tokens.map(item => convertBlockscoutToTokenBalance(item, FUSE_CHAIN_ID));
      } else if (fuseResponse.status === 'rejected') {
        console.warn('Failed to fetch Fuse balances:', fuseResponse.reason);
      }

      // Process soUSD rate
      if (soUSDRate.status === 'fulfilled') {
        rate = soUSDRate.value;
      } else {
        console.warn('Failed to fetch soUSD rate:', soUSDRate.reason);
      }

      // Helper function to check if token is soUSD (vault token)
      const isSoUSDToken = (token: TokenBalance): boolean => {
        return token.contractAddress.toLowerCase() === ADDRESSES.ethereum.vault.toLowerCase() ||
          token.contractAddress.toLowerCase() === ADDRESSES.fuse.vault.toLowerCase();
      };

      // Calculate token values separately for soUSD and regular tokens
      const calculateTokenValue = (token: TokenBalance): { soUSDValue: number; regularValue: number } => {
        if (!token.balance) return { soUSDValue: 0, regularValue: 0 };

        // Convert balance from raw format to decimal format using contractDecimals
        const formattedBalance = parseFloat(token.balance) / Math.pow(10, token.contractDecimals);

        // Special handling for soUSD tokens - use rate from AccountantWithRateProviders
        if (isSoUSDToken(token) && rate > 0) {
          // Rate is in 18 decimals, so divide by 10^18 to get the actual rate
          const soUSDRate = Number(rate) / Math.pow(10, 6);
          const value = formattedBalance * soUSDRate;
          return { soUSDValue: value, regularValue: 0 };
        }

        // For regular tokens, use quoteRate
        if (!token.quoteRate) return { soUSDValue: 0, regularValue: 0 };
        const value = formattedBalance * token.quoteRate;
        return { soUSDValue: 0, regularValue: value };
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
        { soUSD: 0, regular: 0 }
      );

      const fuseTotals = fuseTokens.reduce(
        (acc, token) => {
          const { soUSDValue, regularValue } = calculateTokenValue(token);
          return {
            soUSD: acc.soUSD + soUSDValue,
            regular: acc.regular + regularValue,
          };
        },
        { soUSD: 0, regular: 0 }
      );

      const totalSoUSD = ethereumTotals.soUSD + fuseTotals.soUSD;
      const totalRegular = ethereumTotals.regular + fuseTotals.regular;

      setBalanceData(prev => ({
        ...prev,
        totalUSD: totalSoUSD + totalRegular,
        soUSDValue: totalSoUSD,
        totalUSDExcludingSoUSD: totalRegular,
        ethereumTokens,
        fuseTokens,
        isLoading: false,
        error: null,
      }));

    } catch (error) {
      console.error('Error fetching balances:', error);
      setBalanceData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [user?.safeAddress]);

  const refresh = useCallback(() => {
    fetchBalances();
  }, [fetchBalances]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return {
    totalUSD: balanceData.totalUSD,
    soUSDValue: balanceData.soUSDValue,
    totalUSDExcludingSoUSD: balanceData.totalUSDExcludingSoUSD,
    ethereumTokens: balanceData.ethereumTokens,
    fuseTokens: balanceData.fuseTokens,
    isLoading: balanceData.isLoading,
    error: balanceData.error,
    refresh,
  };
}; 