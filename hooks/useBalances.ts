import { NATIVE_TOKENS } from '@/constants/tokens';
import { fetchTokenPriceUsd } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { PromiseStatus, TokenBalance, TokenType } from '@/lib/types';
import { isSoUSDToken } from '@/lib/utils';
import { publicClient } from '@/lib/wagmi';
import { useQuery } from '@tanstack/react-query';
import { zeroAddress } from 'viem';
import { getBalance, readContract } from 'viem/actions';
import { fuse, mainnet } from 'viem/chains';
import useUser from './useUser';

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
    type: TokenType;
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
};

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
  error: string | null;
  refresh: () => void;
  retry: () => void;
}

// Chain IDs
const ETHEREUM_CHAIN_ID = 1;
const FUSE_CHAIN_ID = 122;

// ABI for AccountantWithRateProviders getRate function
const ACCOUNTANT_ABI = [
  {
    inputs: [],
    name: 'getRate',
    outputs: [
      {
        internalType: 'uint256',
        name: 'rate',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const symbols = {
  'SOUSD': 'soUSD',
  'USDC.E': 'USDC',
}

// Fetch function for token balances
const fetchTokenBalances = async (safeAddress: string) => {
  const [ethereumResponse, fuseResponse, soUSDRate, ethBalance, fuseBalance, ethPrice, fusePrice] =
    await Promise.allSettled([
      fetch(`https://eth.blockscout.com/api/v2/addresses/${safeAddress}/token-balances`, {
        headers: { accept: 'application/json' },
      }),
      fetch(`https://explorer.fuse.io/api/v2/addresses/${safeAddress}/token-balances`, {
        headers: { accept: 'application/json' },
      }),
      readContract(publicClient(mainnet.id), {
        address: ADDRESSES.ethereum.accountant,
        abi: ACCOUNTANT_ABI,
        functionName: 'getRate',
      }),
      getBalance(publicClient(mainnet.id), {
        address: safeAddress as `0x${string}`,
      }),
      getBalance(publicClient(fuse.id), {
        address: safeAddress as `0x${string}`,
      }),
      fetchTokenPriceUsd(NATIVE_TOKENS[mainnet.id]),
      fetchTokenPriceUsd(NATIVE_TOKENS[fuse.id]),
    ]);

  let ethereumTokens: TokenBalance[] = [];
  let fuseTokens: TokenBalance[] = [];
  let rate = 0;

  // Process soUSD rate
  if (soUSDRate.status === PromiseStatus.FULFILLED) {
    rate = Number(soUSDRate.value) / Math.pow(10, 6);
  } else {
    console.warn('Failed to fetch soUSD rate:', soUSDRate.reason);
  }

  // Convert Blockscout format to our standard format
  const convertBlockscoutToTokenBalance = (
    item: BlockscoutTokenBalance,
    chainId: number,
  ): TokenBalance => {
    const address = item.token.address || item.token.address_hash;
    return {
      contractTickerSymbol: symbols[item.token.symbol as keyof typeof symbols] || item.token.symbol,
      contractName: item.token.name,
      contractAddress: address,
      balance: item.value,
      quoteRate: isSoUSDToken(address)
        ? rate
        : item.token.exchange_rate
          ? parseFloat(item.token.exchange_rate)
          : 0,
      logoUrl: isSoUSDToken(address) ? undefined : item.token.icon_url,
      contractDecimals: parseInt(item.token.decimals),
      type: item.token.type,
      verified: true,
      chainId,
    };
  };

  // Process Ethereum response (Blockscout)
  if (ethereumResponse.status === PromiseStatus.FULFILLED && ethereumResponse.value.ok) {
    const ethereumData: BlockscoutResponse = await ethereumResponse.value.json();
    // Filter out NFTs and only include ERC-20 tokens
    ethereumTokens = ethereumData
      .filter(item => item.token.type === TokenType.ERC20)
      .map(item => convertBlockscoutToTokenBalance(item, ETHEREUM_CHAIN_ID));
  } else if (ethereumResponse.status === PromiseStatus.REJECTED) {
    console.warn('Failed to fetch Ethereum balances:', ethereumResponse.reason);
  }

  // Process Fuse response (Blockscout)
  if (fuseResponse.status === PromiseStatus.FULFILLED && fuseResponse.value.ok) {
    const fuseData: BlockscoutResponse = await fuseResponse.value.json();
    // Filter out NFTs and only include ERC-20 tokens
    fuseTokens = fuseData
      .filter(item => item.token.type === TokenType.ERC20)
      .map(item => convertBlockscoutToTokenBalance(item, FUSE_CHAIN_ID));
  } else if (fuseResponse.status === PromiseStatus.REJECTED) {
    console.warn('Failed to fetch Fuse balances:', fuseResponse.reason);
  }

  // Process native token balances
  if (ethBalance.status === PromiseStatus.FULFILLED && Number(ethBalance.value)) {
    const ethPriceValue = ethPrice.status === PromiseStatus.FULFILLED ? Number(ethPrice.value) : 0;
    ethereumTokens.push({
      contractTickerSymbol: 'ETH',
      contractName: 'Ethereum',
      contractAddress: zeroAddress,
      balance: ethBalance.value.toString(),
      quoteRate: ethPriceValue,
      contractDecimals: 18,
      type: TokenType.NATIVE,
      verified: true,
      chainId: ETHEREUM_CHAIN_ID,
    });
  }

  if (fuseBalance.status === PromiseStatus.FULFILLED && Number(fuseBalance.value)) {
    const fusePriceValue =
      fusePrice.status === PromiseStatus.FULFILLED ? Number(fusePrice.value) : 0;
    fuseTokens.push({
      contractTickerSymbol: 'FUSE',
      contractName: 'Fuse',
      contractAddress: zeroAddress,
      balance: fuseBalance.value.toString(),
      quoteRate: fusePriceValue,
      contractDecimals: 18,
      type: TokenType.NATIVE,
      verified: true,
      chainId: FUSE_CHAIN_ID,
    });
  }

  const allTokens = [...ethereumTokens, ...fuseTokens];

  // Helper function to calculate token value
  const calculateTokenValue = (token: TokenBalance): CalculatedTokenValue => {
    const balance = Number(token.balance) / Math.pow(10, token.contractDecimals);
    const value = balance * (token.quoteRate || 0);

    if (isSoUSDToken(token.contractAddress)) {
      return {
        soUSDValue: value,
        regularValue: 0,
        value,
      };
    } else {
      return {
        soUSDValue: 0,
        regularValue: value,
        value,
      };
    }
  };

  // Calculate totals using helper function
  const totals = allTokens.reduce(
    (acc, token) => {
      const tokenValue = calculateTokenValue(token);
      acc.totalUSD += tokenValue.value;
      acc.totalSoUSD += tokenValue.soUSDValue;
      acc.totalUSDExcludingSoUSD += tokenValue.regularValue;

      if (token.chainId === ETHEREUM_CHAIN_ID && tokenValue.soUSDValue > 0) {
        acc.soUSDEthereum += tokenValue.soUSDValue;
      } else if (token.chainId === FUSE_CHAIN_ID && tokenValue.soUSDValue > 0) {
        acc.soUSDFuse += tokenValue.soUSDValue;
      }

      return acc;
    },
    {
      totalUSD: 0,
      totalSoUSD: 0,
      totalUSDExcludingSoUSD: 0,
      soUSDEthereum: 0,
      soUSDFuse: 0,
    },
  );

  return {
    ...totals,
    ethereumTokens,
    fuseTokens,
    tokens: allTokens,
  };
};

export const useBalances = (): BalanceData => {
  const { user } = useUser();

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['tokenBalances', user?.safeAddress],
    queryFn: () => fetchTokenBalances(user?.safeAddress!),
    enabled: !!user?.safeAddress,
    // TanStack Query handles all the manual logic:
    staleTime: 60 * 1000, // 1 minute - data is considered fresh for 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes - data stays in cache for 5 minutes when unused
    retry: 3, // retry up to 3 times on failure
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchOnWindowFocus: true, // refetch when user returns to tab
    refetchOnReconnect: true, // refetch when network reconnects
    // Refetch every 30 seconds when data becomes stale
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
  });

  const defaultData = {
    totalUSD: 0,
    totalSoUSD: 0,
    totalUSDExcludingSoUSD: 0,
    soUSDEthereum: 0,
    soUSDFuse: 0,
    ethereumTokens: [],
    fuseTokens: [],
    tokens: [],
  };

  return {
    ...defaultData,
    ...data,
    isLoading,
    isRefreshing: isRefetching,
    error: error?.message || null,
    refresh: refetch,
    retry: refetch,
  };
};
