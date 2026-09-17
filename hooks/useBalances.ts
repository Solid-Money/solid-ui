import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseUnits, zeroAddress } from 'viem';
import { getBalance, readContract } from 'viem/actions';
import { arbitrum, base, bsc, fuse, mainnet } from 'viem/chains';

import { NATIVE_COINGECKO_TOKENS } from '@/constants/tokens';
import {
  fetchCoinSimplePrice,
  fetchTokenList,
  fetchTokenPricesByAddress,
  fetchTokenPriceUsd,
} from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { fetchTokenBalancesWithFallback } from '@/lib/data-source';
import { PromiseStatus, SwapTokenResponse, TokenBalance, TokenType } from '@/lib/types';
import { isSoETHToken, isSoFUSEToken, isSoUSDToken, isWalletCardExcludedToken } from '@/lib/utils';
import { publicClient } from '@/lib/wagmi';

import { makeNativePriceFetcher } from './useNativePriceUsd';
import useUser from './useUser';

// Blockscout response structure for both Ethereum and Fuse
export interface BlockscoutTokenBalance {
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
  totalUSDExcludingVaultTokens: number;
  soUSDEthereum: number;
  soUSDFuse: number;
  soUSDBase: number;
  ethereumTokens: TokenBalance[];
  fuseTokens: TokenBalance[];
  polygonTokens: TokenBalance[];
  baseTokens: TokenBalance[];
  arbitrumTokens: TokenBalance[];
  bscTokens: TokenBalance[];
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
const POLYGON_CHAIN_ID = 137;
const BASE_CHAIN_ID = 8453;
const ARBITRUM_CHAIN_ID = 42161;
const BSC_CHAIN_ID = 56;

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

/**
 * Native-token USD price per chain. Uses the shared fetcher (Alchemy by symbol,
 * CoinGecko on failure) rather than a bare Alchemy call: FUSE's "symbol" here is
 * a CoinGecko coin id that Alchemy's by-symbol endpoint never resolves, so on
 * its own it yields no price at all.
 */
const NATIVE_PRICE_FETCHERS: Record<number, () => Promise<string | undefined>> = {
  [mainnet.id]: makeNativePriceFetcher(mainnet.id),
  [fuse.id]: makeNativePriceFetcher(fuse.id),
  [base.id]: makeNativePriceFetcher(base.id),
  [arbitrum.id]: makeNativePriceFetcher(arbitrum.id),
  [bsc.id]: makeNativePriceFetcher(bsc.id),
};

const isZeroRate = (r: number | null | undefined) =>
  r == null || r === 0 || (typeof r === 'number' && Number.isNaN(r));

const parsePrice = (v: unknown): number | undefined => {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return !Number.isNaN(n) ? n : undefined;
  }
  return undefined;
};

/**
 * A vault share is worth its exchange rate in the underlying asset, never one
 * for one: soFUSE and soETH are listed under the underlying's own price id
 * (`fuse-network-token` / `weth`), so letting them take a price from the generic
 * fallbacks below values a share as a bare FUSE or ETH and under-reports the
 * holding by the whole accrued yield. Their rate comes from the accountant or
 * not at all. soUSD is excluded from this rule: its price id names the share
 * itself, so a fallback price for it is the right number.
 */
const isUnderlyingPricedShare = (contractAddress: string): boolean =>
  isSoFUSEToken(contractAddress) || isSoETHToken(contractAddress);

// Fetch function for token balances
const fetchTokenBalances = async (safeAddress: string) => {
  const [
    baseResponse,
    ethereumResponse,
    fuseResponse,
    polygonResponse,
    arbitrumResponse,
    bscResponse,
    soUSDRate,
    soFUSERate,
    soETHRate,
    ethBalance,
    fuseBalance,
    baseBalance,
    arbitrumBalance,
    bscBalance,
    ethPrice,
    fusePrice,
    basePrice,
    arbitrumPrice,
    bscPrice,
    tokenList,
  ] = await Promise.allSettled([
    // Token balances via the data-source dispatcher (Alchemy primary,
    // Blockscout fallback). Fuse (122) skips Alchemy entirely. BSC (56)
    // is Alchemy-only — Blockscout has no BSC instance and returns [] on
    // Alchemy failure.
    fetchTokenBalancesWithFallback(BASE_CHAIN_ID, safeAddress),
    fetchTokenBalancesWithFallback(ETHEREUM_CHAIN_ID, safeAddress),
    fetchTokenBalancesWithFallback(FUSE_CHAIN_ID, safeAddress),
    fetchTokenBalancesWithFallback(POLYGON_CHAIN_ID, safeAddress),
    fetchTokenBalancesWithFallback(ARBITRUM_CHAIN_ID, safeAddress),
    fetchTokenBalancesWithFallback(BSC_CHAIN_ID, safeAddress),
    readContract(publicClient(mainnet.id), {
      address: ADDRESSES.ethereum.accountant,
      abi: ACCOUNTANT_ABI,
      functionName: 'getRate',
    }),
    readContract(publicClient(fuse.id), {
      address: ADDRESSES.fuse.fuseAccountant,
      abi: ACCOUNTANT_ABI,
      functionName: 'getRate',
    }),
    // One soETH rate for every chain the share sits on, read from the Ethereum
    // accountant — the same source the savings screen uses.
    readContract(publicClient(mainnet.id), {
      address: ADDRESSES.ethereum.soEthAccountant,
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
    getBalance(publicClient(arbitrum.id), {
      address: safeAddress as `0x${string}`,
    }),
    getBalance(publicClient(bsc.id), {
      address: safeAddress as `0x${string}`,
    }),
    NATIVE_PRICE_FETCHERS[mainnet.id](),
    NATIVE_PRICE_FETCHERS[fuse.id](),
    NATIVE_PRICE_FETCHERS[base.id](),
    NATIVE_PRICE_FETCHERS[arbitrum.id](),
    NATIVE_PRICE_FETCHERS[bsc.id](),
    fetchTokenList({
      isActive: true,
    }),
  ]);

  let ethereumTokens: TokenBalance[] = [];
  let fuseTokens: TokenBalance[] = [];
  let polygonTokens: TokenBalance[] = [];
  let baseTokens: TokenBalance[] = [];
  let arbitrumTokens: TokenBalance[] = [];
  let bscTokens: TokenBalance[] = [];
  let soUSDRateNum = 0;
  let soFUSEQuoteRateUSD = 0;
  let soETHQuoteRateUSD = 0;

  // Process soUSD rate (soUSD → USD, 6 decimals)
  if (soUSDRate.status === PromiseStatus.FULFILLED) {
    soUSDRateNum = Number(soUSDRate.value) / Math.pow(10, 6);
  } else {
    console.warn('Failed to fetch soUSD rate:', soUSDRate.reason);
  }

  // Process soFUSE rate: soFUSE→FUSE (18 decimals) × FUSE price = USD quote rate (align with savings)
  const fusePriceNum =
    fusePrice.status === PromiseStatus.FULFILLED ? parsePrice(fusePrice.value) : undefined;
  const ethPriceNum =
    ethPrice.status === PromiseStatus.FULFILLED ? parsePrice(ethPrice.value) : undefined;

  if (soFUSERate.status === PromiseStatus.FULFILLED && fusePriceNum) {
    const soFUSEToFuse = Number(soFUSERate.value) / Math.pow(10, 18);
    soFUSEQuoteRateUSD = soFUSEToFuse * fusePriceNum;
  } else if (soFUSERate.status === PromiseStatus.REJECTED) {
    console.warn('Failed to fetch soFUSE rate:', soFUSERate.reason);
  } else if (!fusePriceNum) {
    console.warn('No FUSE price — soFUSE left unpriced rather than valued as bare FUSE');
  }

  // Same for soETH: soETH→ETH (18 decimals) × ETH price.
  if (soETHRate.status === PromiseStatus.FULFILLED && ethPriceNum) {
    const soETHToEth = Number(soETHRate.value) / Math.pow(10, 18);
    soETHQuoteRateUSD = soETHToEth * ethPriceNum;
  } else if (soETHRate.status === PromiseStatus.REJECTED) {
    console.warn('Failed to fetch soETH rate:', soETHRate.reason);
  } else if (!ethPriceNum) {
    console.warn('No ETH price — soETH left unpriced rather than valued as bare ETH');
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
    const isSoUSD = isSoUSDToken(address);
    const isSoFUSE = isSoFUSEToken(address);
    const isSoETH = isSoETHToken(address);
    // Vault shares are priced off their accountant rate, not off a market quote
    // for the share (Blockscout has none) or for the underlying asset.
    const quoteRate = isSoUSD
      ? soUSDRateNum
      : isSoFUSE
        ? soFUSEQuoteRateUSD
        : isSoETH
          ? soETHQuoteRateUSD
          : item.token.exchange_rate
            ? parseFloat(item.token.exchange_rate)
            : 0;
    return {
      contractTickerSymbol: String(
        symbols[item.token.symbol as keyof typeof symbols] ?? item.token.symbol,
      ),
      contractName: item.token.name,
      contractAddress: address,
      balance: item.value,
      quoteRate,
      // Prefer the curated swaptokens logo (e.g. Voltage's G$ logo) over
      // Blockscout's CoinGecko icon, which can be dark/low-quality.
      logoUrl: isSoUSD ? undefined : (tokenFromList?.logoURI ?? item.token.icon_url),
      contractDecimals: parseInt(item.token.decimals),
      type: item.token.type as TokenType,
      verified: true,
      chainId,
      commonId: tokenFromList?.commonId,
      tokenId: tokenFromList?.tokenId,
    };
  };

  const tokenListData = tokenList.status === PromiseStatus.FULFILLED ? tokenList.value : [];

  const filterTokenList = (list: SwapTokenResponse[], chainId: number, address: string) => {
    if (list.length === 0) return true;
    return list.some(
      token => token.chainId === chainId && token.address?.toLowerCase() === address?.toLowerCase(),
    );
  };

  // Process Ethereum tokens
  if (ethereumResponse.status === PromiseStatus.FULFILLED) {
    ethereumTokens = ethereumResponse.value
      .filter(
        item =>
          item.token.type === TokenType.ERC20 &&
          filterTokenList(tokenListData, ETHEREUM_CHAIN_ID, getAddress(item)),
      )
      .map(item => convertBlockscoutToTokenBalance(item, ETHEREUM_CHAIN_ID));
  } else {
    console.warn('Failed to fetch Ethereum balances:', ethereumResponse.reason);
  }

  // Process Base tokens
  if (baseResponse.status === PromiseStatus.FULFILLED) {
    baseTokens = baseResponse.value
      .filter(
        item =>
          item.token.type === TokenType.ERC20 &&
          filterTokenList(tokenListData, BASE_CHAIN_ID, getAddress(item)),
      )
      .map(item => convertBlockscoutToTokenBalance(item, BASE_CHAIN_ID));
  } else {
    console.warn('Failed to fetch Base balances:', baseResponse.reason);
  }

  // Process Fuse tokens (always Blockscout)
  if (fuseResponse.status === PromiseStatus.FULFILLED) {
    fuseTokens = fuseResponse.value
      .filter(
        item =>
          item.token.type === TokenType.ERC20 &&
          filterTokenList(tokenListData, FUSE_CHAIN_ID, getAddress(item)),
      )
      .map(item => convertBlockscoutToTokenBalance(item, FUSE_CHAIN_ID));
  } else {
    console.warn('Failed to fetch Fuse balances:', fuseResponse.reason);
  }

  // Process Polygon tokens
  if (polygonResponse.status === PromiseStatus.FULFILLED) {
    polygonTokens = polygonResponse.value
      .filter(
        item =>
          item.token.type === TokenType.ERC20 &&
          filterTokenList(tokenListData, POLYGON_CHAIN_ID, getAddress(item)),
      )
      .map(item => convertBlockscoutToTokenBalance(item, POLYGON_CHAIN_ID));
  } else {
    console.warn('Failed to fetch Polygon balances:', polygonResponse.reason);
  }

  // Process Arbitrum tokens
  if (arbitrumResponse.status === PromiseStatus.FULFILLED) {
    arbitrumTokens = arbitrumResponse.value
      .filter(
        item =>
          item.token.type === TokenType.ERC20 &&
          filterTokenList(tokenListData, ARBITRUM_CHAIN_ID, getAddress(item)),
      )
      .map(item => convertBlockscoutToTokenBalance(item, ARBITRUM_CHAIN_ID));
  } else {
    console.warn('Failed to fetch Arbitrum balances:', arbitrumResponse.reason);
  }

  // Process BSC tokens
  if (bscResponse.status === PromiseStatus.FULFILLED) {
    bscTokens = bscResponse.value
      .filter(
        item =>
          item.token.type === TokenType.ERC20 &&
          filterTokenList(tokenListData, BSC_CHAIN_ID, getAddress(item)),
      )
      .map(item => convertBlockscoutToTokenBalance(item, BSC_CHAIN_ID));
  } else {
    console.warn('Failed to fetch BSC balances:', bscResponse.reason);
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
      tokenId: ethTokenFromList?.tokenId,
    });
  }

  if (fuseBalance.status === PromiseStatus.FULFILLED && Number(fuseBalance.value)) {
    const fusePriceValue =
      fusePrice.status === PromiseStatus.FULFILLED ? Number(fusePrice.value) : 0;
    const fuseQuoteRate =
      typeof fusePriceValue === 'number' && !Number.isNaN(fusePriceValue) ? fusePriceValue : 0;
    const fuseTokenFromList = tokenListData.find(
      token => token.chainId === FUSE_CHAIN_ID && token.symbol === 'FUSE',
    );
    fuseTokens.push({
      contractTickerSymbol: 'FUSE',
      contractName: 'Fuse',
      contractAddress: zeroAddress,
      balance: fuseBalance.value.toString(),
      quoteRate: fuseQuoteRate,
      contractDecimals: 18,
      type: TokenType.NATIVE,
      verified: true,
      chainId: FUSE_CHAIN_ID,
      commonId: fuseTokenFromList?.commonId,
      tokenId: fuseTokenFromList?.tokenId,
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
      tokenId: baseEthTokenFromList?.tokenId,
    });
  }

  if (arbitrumBalance.status === PromiseStatus.FULFILLED && Number(arbitrumBalance.value)) {
    const arbitrumPriceValue =
      arbitrumPrice.status === PromiseStatus.FULFILLED ? Number(arbitrumPrice.value) : 0;
    const arbitrumEthTokenFromList = tokenListData.find(
      token => token.chainId === ARBITRUM_CHAIN_ID && token.symbol === 'ETH',
    );
    arbitrumTokens.push({
      contractTickerSymbol: 'ETH',
      contractName: 'Ether',
      contractAddress: zeroAddress,
      balance: arbitrumBalance.value.toString(),
      quoteRate: arbitrumPriceValue,
      contractDecimals: 18,
      type: TokenType.NATIVE,
      verified: true,
      chainId: ARBITRUM_CHAIN_ID,
      commonId: arbitrumEthTokenFromList?.commonId,
      tokenId: arbitrumEthTokenFromList?.tokenId,
    });
  }

  if (bscBalance.status === PromiseStatus.FULFILLED && Number(bscBalance.value)) {
    const bscPriceValue = bscPrice.status === PromiseStatus.FULFILLED ? Number(bscPrice.value) : 0;
    const bscBnbTokenFromList = tokenListData.find(
      token => token.chainId === BSC_CHAIN_ID && token.symbol === 'BNB',
    );
    bscTokens.push({
      contractTickerSymbol: 'BNB',
      contractName: 'BNB',
      contractAddress: zeroAddress,
      balance: bscBalance.value.toString(),
      quoteRate: bscPriceValue,
      contractDecimals: 18,
      type: TokenType.NATIVE,
      verified: true,
      chainId: BSC_CHAIN_ID,
      commonId: bscBnbTokenFromList?.commonId,
      tokenId: bscBnbTokenFromList?.tokenId,
    });
  }

  let allTokens = [
    ...ethereumTokens,
    ...fuseTokens,
    ...polygonTokens,
    ...baseTokens,
    ...arbitrumTokens,
    ...bscTokens,
  ];

  // Fallback 1: Alchemy Prices by contract address. Alchemy's token balances
  // carry no exchange rate (only Blockscout's do), so every ERC-20 on an
  // Alchemy-served chain lands here at 0. Runs ahead of the coin-id and symbol
  // lookups below because an address names a token exactly, and needs no
  // swaptokens entry to resolve — a token missing from the curated list still
  // gets a price.
  const addressPriceTokens = allTokens.filter(
    t =>
      isZeroRate(t.quoteRate) &&
      t.type !== TokenType.NATIVE &&
      t.contractAddress &&
      !isUnderlyingPricedShare(t.contractAddress),
  );
  if (addressPriceTokens.length > 0) {
    try {
      const priceByAddress = await fetchTokenPricesByAddress(
        addressPriceTokens.map(t => ({ chainId: t.chainId, address: t.contractAddress })),
      );
      allTokens = allTokens.map(t => {
        if (
          !isZeroRate(t.quoteRate) ||
          t.type === TokenType.NATIVE ||
          isUnderlyingPricedShare(t.contractAddress)
        )
          return t;
        const usd = priceByAddress[`${t.chainId}:${t.contractAddress?.toLowerCase()}`];
        if (usd != null && usd > 0) return { ...t, quoteRate: usd };
        return t;
      });
    } catch (e) {
      console.warn('Alchemy by-address price lookup failed:', e);
    }
  }

  // Fallback 2: CoinGecko by coin id (tokenId for ERC20, NATIVE_COINGECKO_TOKENS for native)
  const zeroRateTokens = allTokens.filter(
    t => isZeroRate(t.quoteRate) && !isUnderlyingPricedShare(t.contractAddress),
  );
  const coinIds = [
    ...new Set(
      zeroRateTokens
        .map(t => (t.type === TokenType.NATIVE ? NATIVE_COINGECKO_TOKENS[t.chainId] : t.tokenId))
        .filter((id): id is string => !!id),
    ),
  ];
  if (coinIds.length > 0) {
    try {
      const priceMap = await fetchCoinSimplePrice(coinIds);
      allTokens = allTokens.map(t => {
        if (!isZeroRate(t.quoteRate) || isUnderlyingPricedShare(t.contractAddress)) return t;
        const id = t.type === TokenType.NATIVE ? NATIVE_COINGECKO_TOKENS[t.chainId] : t.tokenId;
        const usd = id ? parsePrice(priceMap[id]?.usd) : undefined;
        if (usd != null && usd > 0) return { ...t, quoteRate: usd };
        return t;
      });
    } catch (e) {
      console.warn('CoinGecko fallback price failed:', e);
    }
  }

  // Fallback 3: Alchemy by symbol for tokens still at 0 (no tokenId)
  const stillZero = allTokens.filter(
    t =>
      isZeroRate(t.quoteRate) &&
      t.contractTickerSymbol &&
      !isUnderlyingPricedShare(t.contractAddress),
  );
  const symbolsToFetch = [...new Set(stillZero.map(t => t.contractTickerSymbol))];
  if (symbolsToFetch.length > 0) {
    try {
      const results = await Promise.allSettled(symbolsToFetch.map(s => fetchTokenPriceUsd(s)));
      const symbolToPrice: Record<string, number> = {};
      symbolsToFetch.forEach((sym, i) => {
        const r = results[i];
        if (r.status === 'fulfilled') {
          const p = parsePrice(r.value);
          if (p != null && p > 0) symbolToPrice[sym] = p;
        }
      });
      allTokens = allTokens.map(t => {
        if (!isZeroRate(t.quoteRate) || isUnderlyingPricedShare(t.contractAddress)) return t;
        const p = t.contractTickerSymbol && symbolToPrice[t.contractTickerSymbol];
        if (typeof p === 'number') return { ...t, quoteRate: p };
        return t;
      });
    } catch (e) {
      console.warn('Alchemy fallback price failed:', e);
    }
  }

  // Helper function to calculate token value
  const calculateTokenValue = (token: TokenBalance): CalculatedTokenValue => {
    const balance = Number(token.balance) / Math.pow(10, token.contractDecimals);
    const value = balance * (token.quoteRate || 0);

    if (isWalletCardExcludedToken(token.contractAddress)) {
      const isSoUSD = token.contractTickerSymbol === 'soUSD';
      return {
        soUSDValue: isSoUSD ? value : 0,
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
      acc.totalUSDExcludingVaultTokens += tokenValue.regularValue;

      if (token.chainId === ETHEREUM_CHAIN_ID && tokenValue.soUSDValue > 0) {
        acc.soUSDEthereum += tokenValue.soUSDValue;
      } else if (token.chainId === FUSE_CHAIN_ID && tokenValue.soUSDValue > 0) {
        acc.soUSDFuse += tokenValue.soUSDValue;
      } else if (token.chainId === BASE_CHAIN_ID && tokenValue.soUSDValue > 0) {
        acc.soUSDBase += tokenValue.soUSDValue;
      } else if (token.chainId === ARBITRUM_CHAIN_ID && tokenValue.soUSDValue > 0) {
        acc.soUSDArbitrum += tokenValue.soUSDValue;
      }

      return acc;
    },
    {
      totalUSD: 0,
      totalSoUSD: 0,
      totalUSDExcludingVaultTokens: 0,
      soUSDEthereum: 0,
      soUSDFuse: 0,
      soUSDBase: 0,
      soUSDArbitrum: 0,
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

  // Return chain arrays from updated allTokens so quoteRates from fallbacks are included
  const ethereumTokensFinal = allTokens.filter(t => t.chainId === ETHEREUM_CHAIN_ID);
  const fuseTokensFinal = allTokens.filter(t => t.chainId === FUSE_CHAIN_ID);
  const polygonTokensFinal = allTokens.filter(t => t.chainId === POLYGON_CHAIN_ID);
  const baseTokensFinal = allTokens.filter(t => t.chainId === BASE_CHAIN_ID);
  const arbitrumTokensFinal = allTokens.filter(t => t.chainId === ARBITRUM_CHAIN_ID);
  const bscTokensFinal = allTokens.filter(t => t.chainId === BSC_CHAIN_ID);

  return {
    ...totals,
    ethereumTokens: ethereumTokensFinal,
    fuseTokens: fuseTokensFinal,
    polygonTokens: polygonTokensFinal,
    baseTokens: baseTokensFinal,
    arbitrumTokens: arbitrumTokensFinal,
    bscTokens: bscTokensFinal,
    tokens: allTokens,
    unifiedTokens,
  };
};

// Module-level so the empty arrays keep one identity for the whole session.
// Built inline per render, every consumer memoised on `tokens` (coin breakdown,
// unique-token lists, the activity list's derived chain) was invalidated on each
// render for as long as the query had no data — first load, and again after any
// failure.
const EMPTY_BALANCE_DATA = {
  totalUSD: 0,
  totalSoUSD: 0,
  totalUSDExcludingVaultTokens: 0,
  soUSDEthereum: 0,
  soUSDFuse: 0,
  soUSDBase: 0,
  ethereumTokens: [] as TokenBalance[],
  fuseTokens: [] as TokenBalance[],
  polygonTokens: [] as TokenBalance[],
  baseTokens: [] as TokenBalance[],
  arbitrumTokens: [] as TokenBalance[],
  bscTokens: [] as TokenBalance[],
  tokens: [] as TokenBalance[],
  unifiedTokens: [] as UnifiedTokenBalance[],
};

export const useBalances = (): BalanceData => {
  const { user } = useUser();

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['tokenBalances', user?.safeAddress],
    queryFn: () => fetchTokenBalances(user?.safeAddress!),
    enabled: !!user?.safeAddress,
    // TanStack Query handles all the manual logic:
    staleTime: 5_000,
    gcTime: 5 * 60 * 1000, // 5 minutes - data stays in cache for 5 minutes when unused
    retry: 3, // retry up to 3 times on failure
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchOnWindowFocus: true, // refetch when user returns to tab
    refetchOnReconnect: true, // refetch when network reconnects
    // SSE handles real-time updates; polling is fallback for missed events or SSE failure
    refetchInterval: 5_000,
    refetchIntervalInBackground: false, // Don't refetch when app is backgrounded (saves battery)
  });

  return {
    ...EMPTY_BALANCE_DATA,
    ...data,
    isLoading,
    isRefreshing: isRefetching,
    error: error?.message || null,
    refresh: refetch,
    retry: refetch,
  };
};

export const tokenBalancesQueryOptions = (safeAddress: string | undefined) => ({
  queryKey: ['tokenBalances', safeAddress],
  queryFn: () => fetchTokenBalances(safeAddress!),
  enabled: !!safeAddress,
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
});
