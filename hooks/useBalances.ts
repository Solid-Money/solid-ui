import { NATIVE_TOKENS } from '@/constants/tokens';
import { fetchTokenList, fetchTokenPriceUsd } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { PromiseStatus, SwapTokenResponse, TokenBalance, TokenType } from '@/lib/types';
import { isSoUSDToken } from '@/lib/utils';
import { publicClient } from '@/lib/wagmi';
import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseUnits, zeroAddress } from 'viem';
import { getBalance, readContract } from 'viem/actions';
import { base, fuse, mainnet } from 'viem/chains';
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

interface UnifiedTokenBalance extends TokenBalance {
  unifiedBalance: string;
  unifiedBalanceUSD: number;
  chainBalances: TokenBalance[];
}

interface BalanceData {
  totalUSD: number;
  totalSoUSD: number;
  totalUSDExcludingSoUSD: number;
  soUSDEthereum: number;
  soUSDFuse: number;
  soUSDBase: number;
  ethereumTokens: TokenBalance[];
  fuseTokens: TokenBalance[];
  baseTokens: TokenBalance[];
  tokens: TokenBalance[];
  unifiedTokens: UnifiedTokenBalance[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => void;
  retry: () => void;
}

// Chain IDs
const ETHEREUM_CHAIN_ID = 1;
const FUSE_CHAIN_ID = 122;
const BASE_CHAIN_ID = 8453;

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
  SOUSD: 'soUSD',
  'USDC.E': 'USDC',
};

// Fetch function for token balances
const fetchTokenBalances = async (safeAddress: string) => {
  const [
    baseResponse,
    ethereumResponse,
    fuseResponse,
    soUSDRate,
    ethBalance,
    fuseBalance,
    baseBalance,
    ethPrice,
    fusePrice,
    basePrice,
    tokenList,
  ] = await Promise.allSettled([
    fetch(`https://base.blockscout.com/api/v2/addresses/${safeAddress}/token-balances`, {
      headers: { accept: 'application/json' },
    }),
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
    getBalance(publicClient(base.id), {
      address: safeAddress as `0x${string}`,
    }),
    fetchTokenPriceUsd(NATIVE_TOKENS[mainnet.id]),
    fetchTokenPriceUsd(NATIVE_TOKENS[fuse.id]),
    fetchTokenPriceUsd(NATIVE_TOKENS[base.id]),
    fetchTokenList({
      isActive: true,
    }),
  ]);

  let ethereumTokens: TokenBalance[] = [];
  let fuseTokens: TokenBalance[] = [];
  let baseTokens: TokenBalance[] = [];
  let rate = 0;

  // Process soUSD rate
  if (soUSDRate.status === PromiseStatus.FULFILLED) {
    rate = Number(soUSDRate.value) / Math.pow(10, 6);
  } else {
    console.warn('Failed to fetch soUSD rate:', soUSDRate.reason);
  }

  const getAddress = (item: BlockscoutTokenBalance) => {
    return item.token.address || item.token.address_hash;
  };

  // Convert Blockscout format to our standard format
  const convertBlockscoutToTokenBalance = (
    item: BlockscoutTokenBalance,
    chainId: number,
  ): TokenBalance => {
    const address = getAddress(item);
    const tokenFromList = tokenListData.find(
      token => token.chainId === chainId && token.address?.toLowerCase() === address?.toLowerCase(),
    );
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
      type: item.token.type as TokenType,
      verified: true,
      chainId,
      commonId: tokenFromList?.commonId,
    };
  };

  const tokenListData = tokenList.status === PromiseStatus.FULFILLED ? tokenList.value : [];

  const filterTokenList = (list: SwapTokenResponse[], chainId: number, address: string) => {
    if (list.length === 0) return true;
    return list.some(
      token => token.chainId === chainId && token.address?.toLowerCase() === address?.toLowerCase(),
    );
  };

  // Process Ethereum response (Blockscout)
  if (ethereumResponse.status === PromiseStatus.FULFILLED && ethereumResponse.value.ok) {
    const ethereumData: BlockscoutResponse = await ethereumResponse.value.json();
    // Filter out NFTs and only include ERC-20 tokens
    ethereumTokens = ethereumData
      .filter(
        item =>
          item.token.type === TokenType.ERC20 &&
          filterTokenList(tokenListData, ETHEREUM_CHAIN_ID, getAddress(item)),
      )
      .map(item => convertBlockscoutToTokenBalance(item, ETHEREUM_CHAIN_ID));
  } else if (ethereumResponse.status === PromiseStatus.REJECTED) {
    console.warn('Failed to fetch Ethereum balances:', ethereumResponse.reason);
  }

  // Process Base response (Blockscout)
  if (baseResponse.status === PromiseStatus.FULFILLED && baseResponse.value.ok) {
    const baseData: BlockscoutResponse = await baseResponse.value.json();
    // Filter out NFTs and only include ERC-20 tokens
    baseTokens = baseData
      .filter(
        item =>
          item.token.type === TokenType.ERC20 &&
          filterTokenList(tokenListData, BASE_CHAIN_ID, getAddress(item)),
      )
      .map(item => convertBlockscoutToTokenBalance(item, BASE_CHAIN_ID));
  } else if (baseResponse.status === PromiseStatus.REJECTED) {
    console.warn('Failed to fetch Base balances:', baseResponse.reason);
  }

  // Process Fuse response (Blockscout)
  if (fuseResponse.status === PromiseStatus.FULFILLED && fuseResponse.value.ok) {
    const fuseData: BlockscoutResponse = await fuseResponse.value.json();
    // Filter out NFTs and only include ERC-20 tokens
    fuseTokens = fuseData
      .filter(
        item =>
          item.token.type === TokenType.ERC20 &&
          filterTokenList(tokenListData, FUSE_CHAIN_ID, getAddress(item)),
      )
      .map(item => convertBlockscoutToTokenBalance(item, FUSE_CHAIN_ID));
  } else if (fuseResponse.status === PromiseStatus.REJECTED) {
    console.warn('Failed to fetch Fuse balances:', fuseResponse.reason);
  }

  // Process native token balances
  if (ethBalance.status === PromiseStatus.FULFILLED && Number(ethBalance.value)) {
    const ethPriceValue = ethPrice.status === PromiseStatus.FULFILLED ? Number(ethPrice.value) : 0;
    const ethTokenFromList = tokenListData.find(
      token => token.chainId === ETHEREUM_CHAIN_ID && token.symbol === 'ETH',
    );
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
      commonId: ethTokenFromList?.commonId,
    });
  }

  if (fuseBalance.status === PromiseStatus.FULFILLED && Number(fuseBalance.value)) {
    const fusePriceValue =
      fusePrice.status === PromiseStatus.FULFILLED ? Number(fusePrice.value) : 0;
    const fuseTokenFromList = tokenListData.find(
      token => token.chainId === FUSE_CHAIN_ID && token.symbol === 'FUSE',
    );
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
      commonId: fuseTokenFromList?.commonId,
    });
  }

  if (baseBalance.status === PromiseStatus.FULFILLED && Number(baseBalance.value)) {
    const basePriceValue =
      basePrice.status === PromiseStatus.FULFILLED ? Number(basePrice.value) : 0;
    const baseEthTokenFromList = tokenListData.find(
      token => token.chainId === BASE_CHAIN_ID && token.symbol === 'ETH',
    );
    baseTokens.push({
      contractTickerSymbol: 'ETH',
      contractName: 'Ether',
      contractAddress: zeroAddress,
      balance: baseBalance.value.toString(),
      quoteRate: basePriceValue,
      contractDecimals: 18,
      type: TokenType.NATIVE,
      verified: true,
      chainId: BASE_CHAIN_ID,
      commonId: baseEthTokenFromList?.commonId,
    });
  }

  const allTokens = [...ethereumTokens, ...fuseTokens, ...baseTokens];

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
      } else if (token.chainId === BASE_CHAIN_ID && tokenValue.soUSDValue > 0) {
        acc.soUSDBase += tokenValue.soUSDValue;
      }

      return acc;
    },
    {
      totalUSD: 0,
      totalSoUSD: 0,
      totalUSDExcludingSoUSD: 0,
      soUSDEthereum: 0,
      soUSDFuse: 0,
      soUSDBase: 0,
    },
  );

  const unifiedTokensMap = new Map<string, UnifiedTokenBalance>();

  allTokens.forEach(token => {
    const key = token.commonId || token.contractTickerSymbol;
    const balance = Number(formatUnits(BigInt(token.balance || '0'), token.contractDecimals));
    const balanceUSD = balance * (token.quoteRate || 0);

    const existing = unifiedTokensMap.get(key);

    if (existing) {
      const unifiedBalanceStr = formatUnits(
        BigInt(existing.unifiedBalance || '0'),
        existing.contractDecimals,
      );
      const tokenBalanceStr = formatUnits(BigInt(token.balance || '0'), token.contractDecimals);
      const totalBalanceNum = Number(unifiedBalanceStr) + Number(tokenBalanceStr);

      const maxDecimals = Math.max(existing.contractDecimals, token.contractDecimals);
      const totalBalanceBigInt = parseUnits(totalBalanceNum.toFixed(maxDecimals), maxDecimals);

      existing.unifiedBalance = totalBalanceBigInt.toString();
      existing.contractDecimals = maxDecimals;
      existing.unifiedBalanceUSD += balanceUSD;
      existing.chainBalances.push(token);
    } else {
      unifiedTokensMap.set(key, {
        ...token,
        unifiedBalance: token.balance,
        unifiedBalanceUSD: balanceUSD,
        chainBalances: [token],
      });
    }
  });

  const unifiedTokens = Array.from(unifiedTokensMap.values());

  return {
    ...totals,
    ethereumTokens,
    fuseTokens,
    baseTokens,
    tokens: allTokens,
    unifiedTokens,
  };
};

export const useBalances = (): BalanceData => {
  const { user } = useUser();

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['tokenBalances', user?.safeAddress],
    queryFn: () => fetchTokenBalances(user?.safeAddress!),
    enabled: !!user?.safeAddress,
    // TanStack Query handles all the manual logic:
    staleTime: 30 * 1000, // 30 seconds - data is considered fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes - data stays in cache for 5 minutes when unused
    retry: 3, // retry up to 3 times on failure
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchOnWindowFocus: true, // refetch when user returns to tab
    refetchOnReconnect: true, // refetch when network reconnects
    // SSE handles real-time updates; polling is fallback for missed events or SSE failure
    refetchInterval: (query) => {
      const hasBalance = query.state.data?.tokens?.some(t => Number(t.balance) > 0);
      // 5-minute interval when balance exists; 10-minute fallback when no balance
      // (ensures new deposits are detected even if SSE is down)
      return hasBalance ? 5 * 60 * 1000 : 10 * 60 * 1000;
    },
    refetchIntervalInBackground: false, // Don't refetch when app is backgrounded (saves battery)
  });

  const defaultData = {
    totalUSD: 0,
    totalSoUSD: 0,
    totalUSDExcludingSoUSD: 0,
    soUSDEthereum: 0,
    soUSDFuse: 0,
    soUSDBase: 0,
    ethereumTokens: [],
    fuseTokens: [],
    baseTokens: [],
    tokens: [],
    unifiedTokens: [],
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

// Query options for prefetching token balances
export const tokenBalancesQueryOptions = (safeAddress: string | undefined) => ({
  queryKey: ['tokenBalances', safeAddress],
  queryFn: () => fetchTokenBalances(safeAddress!),
  enabled: !!safeAddress,
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
});
