import { type QueryFunctionContext, useQuery } from '@tanstack/react-query';
import { formatUnits, parseUnits, zeroAddress } from 'viem';
import { getBalance, readContract } from 'viem/actions';
import { arbitrum, base, bsc, fuse, mainnet, optimism, polygon } from 'viem/chains';

import { NATIVE_COINGECKO_TOKENS } from '@/constants/tokens';
import { isWalletDepositContract } from '@/constants/walletDepositTokens';
import {
  fetchCoinPricesById,
  fetchTokenList,
  fetchTokenPricesByAddress,
  fetchTokenPricesBySymbol,
} from '@/lib/api';
import { ADDRESSES, isDevFeatureEnabled } from '@/lib/config';
import { fetchTokenBalancesWithFallback } from '@/lib/data-source';
import { PromiseStatus, SwapTokenResponse, TokenBalance, TokenType } from '@/lib/types';
import {
  isSoETHToken,
  isSoEURCToken,
  isSoFUSEToken,
  isSoUSDToken,
  isWalletCardExcludedToken,
} from '@/lib/utils';
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
  /** A failed network read must not be presented as a confirmed empty wallet. */
  failedChainIds: number[];
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
  optimismTokens: TokenBalance[];
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
// A deposit chain only: nothing bridges or saves from it, but what lands there
// is the user's and has to show.
const OPTIMISM_CHAIN_ID = 10;

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
 * then CoinGecko through the backend) rather than a bare Alchemy call, so a
 * chain still gets a price while Alchemy has none or is rate-limiting us. The
 * five lookups start in the same tick, so they ride one Prices API request —
 * ETH is asked for once, not once per chain — and are served from cache for the
 * next minute.
 */
const NATIVE_PRICE_FETCHERS: Record<number, () => Promise<string | undefined>> = {
  [mainnet.id]: makeNativePriceFetcher(mainnet.id),
  [fuse.id]: makeNativePriceFetcher(fuse.id),
  [base.id]: makeNativePriceFetcher(base.id),
  [arbitrum.id]: makeNativePriceFetcher(arbitrum.id),
  [bsc.id]: makeNativePriceFetcher(bsc.id),
  [polygon.id]: makeNativePriceFetcher(polygon.id),
  [optimism.id]: makeNativePriceFetcher(optimism.id),
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
 *
 * soEURC is on this list too, for a stronger reason: it is held and shown in EUR
 * and has no USD quote at all (see `soEURCQuoteRate`), so no fallback may give it
 * one — a dollar price here would carry it into every USD sum built on quoteRate.
 */
const isUnderlyingPricedShare = (contractAddress: string): boolean =>
  isSoFUSEToken(contractAddress) || isSoETHToken(contractAddress) || isSoEURCToken(contractAddress);

/**
 * soEURC's `quoteRate`, which is a USD quote everywhere it is read: always 0.
 *
 * The EUR vault is never converted into a USD figure (see `lib/vaultCurrency.ts`),
 * and every consumer of `quoteRate` multiplies and sums it as dollars. Its EUR
 * value comes from the soEURC accountant instead (`useVaultExchangeRate('EUR')`).
 * TODO(soEURC): wallet and coin rows that print `balance × quoteRate` show $0 for
 * soEURC until they learn to show a EUR line.
 */
const soEURCQuoteRate = 0;

/**
 * Whether a Base token is kept although the curated token list does not name it.
 * soEURC is kept in every build, so whoever holds it can find and withdraw the
 * position before the backend adds the share to its list.
 */
const isKeptUnlisted = (chainId: number, address: string) =>
  chainId === BASE_CHAIN_ID && isSoEURCToken(address);

/**
 * How long a chain's token list or a token's price may stand in for a read that failed.
 * Long enough to ride out a run of failed polls; short enough that a balance spent elsewhere
 * stops reading as available within minutes, and a cache restored at launch carries nothing.
 */
const CARRY_OVER_MAX_AGE_MS = 5 * 60 * 1000;

/** When each chain's token list, and each token's price, was last actually read. */
interface ReadTimes {
  chainReadAt?: Record<number, number>;
  priceReadAt?: Record<string, number>;
}

type PreviousBalances = Pick<BalanceData, 'tokens'> & ReadTimes;

const priceKey = (token: TokenBalance) =>
  `${token.chainId}:${token.type}:${token.contractAddress?.toLowerCase()}`;

// Fetch function for token balances. `previous` is the result already in the cache, used
// only to stand in for a read that failed this time — see `lastKnownTokens`.
const fetchTokenBalances = async (safeAddress: string, previous?: PreviousBalances) => {
  const [
    baseResponse,
    ethereumResponse,
    fuseResponse,
    polygonResponse,
    arbitrumResponse,
    bscResponse,
    optimismResponse,
    soUSDRate,
    soUSDBaseRate,
    soFUSERate,
    soETHRate,
    ethBalance,
    fuseBalance,
    baseBalance,
    arbitrumBalance,
    bscBalance,
    polygonBalance,
    optimismBalance,
    ethPrice,
    fusePrice,
    basePrice,
    arbitrumPrice,
    bscPrice,
    polygonPrice,
    optimismPrice,
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
    fetchTokenBalancesWithFallback(OPTIMISM_CHAIN_ID, safeAddress),
    readContract(publicClient(mainnet.id), {
      address: ADDRESSES.ethereum.accountant,
      abi: ACCOUNTANT_ABI,
      functionName: 'getRate',
    }),
    // soUSD on Base redeems through the Base queue, which prices shares off the
    // Base accountant, not Ethereum's.
    ADDRESSES.base.accountant !== zeroAddress
      ? readContract(publicClient(base.id), {
          address: ADDRESSES.base.accountant,
          abi: ACCOUNTANT_ABI,
          functionName: 'getRate',
        })
      : Promise.reject(new Error('No soUSD accountant on Base in this build')),
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
    getBalance(publicClient(polygon.id), {
      address: safeAddress as `0x${string}`,
    }),
    getBalance(publicClient(optimism.id), {
      address: safeAddress as `0x${string}`,
    }),
    NATIVE_PRICE_FETCHERS[mainnet.id](),
    NATIVE_PRICE_FETCHERS[fuse.id](),
    NATIVE_PRICE_FETCHERS[base.id](),
    NATIVE_PRICE_FETCHERS[arbitrum.id](),
    NATIVE_PRICE_FETCHERS[bsc.id](),
    NATIVE_PRICE_FETCHERS[polygon.id](),
    NATIVE_PRICE_FETCHERS[optimism.id](),
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
  let optimismTokens: TokenBalance[] = [];
  let soUSDRateNum = 0;
  let soUSDBaseRateNum = 0;
  let soFUSEQuoteRateUSD = 0;
  let soETHQuoteRateUSD = 0;

  const now = Date.now();
  // Carried values keep the time of the read they came from, never this poll's, so a run of
  // failures ages them out however many polls pass.
  const chainReadAt: Record<number, number> = {};
  const priceReadAt: Record<string, number> = {};
  const isFresh = (readAt: number | undefined): readAt is number =>
    readAt !== undefined && now - readAt <= CARRY_OVER_MAX_AGE_MS;

  // A chain whose read failed keeps the ERC-20s it held on the last good read, rather than
  // reading as empty until the next poll. Every poll replaces the whole result, so one failed
  // Base read took EURC out of the card's spendable figure for that poll. `failedChainIds`
  // still names the chain, so nothing reads the carried rows as a confirmed answer. Past
  // CARRY_OVER_MAX_AGE_MS the chain reads as empty again.
  const carriedPriceKeys = new Set<string>();
  const lastKnownTokens = (chainId: number): TokenBalance[] => {
    const readAt = previous?.chainReadAt?.[chainId];
    if (!isFresh(readAt)) return [];
    chainReadAt[chainId] = readAt;
    return (previous?.tokens ?? [])
      .filter(token => token.chainId === chainId && token.type === TokenType.ERC20)
      .map(token => {
        const key = priceKey(token);
        if (isFresh(previous?.priceReadAt?.[key])) {
          carriedPriceKeys.add(key);
          return token;
        }
        // Its price is too old to show: price it again this poll, like a row just read.
        return { ...token, quoteRate: 0 };
      });
  };

  // Process soUSD rate (soUSD → USD, 6 decimals)
  if (soUSDRate.status === PromiseStatus.FULFILLED) {
    soUSDRateNum = Number(soUSDRate.value) / Math.pow(10, 6);
  } else {
    console.warn('Failed to fetch soUSD rate:', soUSDRate.reason);
  }
  if (soUSDBaseRate.status === PromiseStatus.FULFILLED) {
    soUSDBaseRateNum = Number(soUSDBaseRate.value) / Math.pow(10, 6);
  } else {
    console.warn('Failed to fetch Base soUSD rate:', soUSDBaseRate.reason);
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
    const isSoUSD = isSoUSDToken(address);
    // soUSD on Base, where withdrawals pass through, is not in the curated list.
    // It takes another chain's soUSD entry, so it links to the same coin.
    const tokenFromList =
      tokenListData.find(
        token =>
          token.chainId === chainId && token.address?.toLowerCase() === address?.toLowerCase(),
      ) ?? (isSoUSD ? tokenListData.find(token => isSoUSDToken(token.address ?? '')) : undefined);
    const isSoFUSE = isSoFUSEToken(address);
    const isSoETH = isSoETHToken(address);
    const isSoEURC = isSoEURCToken(address);
    // Vault shares are priced off their accountant rate, not off a market quote
    // for the share (Blockscout has none) or for the underlying asset. soEURC
    // gets no USD quote at all — it is a EUR position.
    const quoteRate = isSoUSD
      ? chainId === BASE_CHAIN_ID
        ? soUSDBaseRateNum
        : soUSDRateNum
      : isSoFUSE
        ? soFUSEQuoteRateUSD
        : isSoETH
          ? soETHQuoteRateUSD
          : isSoEURC
            ? soEURCQuoteRate
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

  // Degrade as before: without the curated list every screen still gets balances. Throwing
  // here took Send, Swap and the wallet down with the Assets overview.
  const tokenListData = tokenList.status === PromiseStatus.FULFILLED ? tokenList.value : [];

  // soUSD shares are never in the swap list, but must still show: soUSD on Base
  // is where a withdrawal sits between its bridge and its queue request. So must
  // anything the deposit screen told the user to send, listed for swapping or not.
  const filterTokenList = (list: SwapTokenResponse[], chainId: number, address: string) => {
    if (list.length === 0 || isSoUSDToken(address)) return true;
    if (isKeptUnlisted(chainId, address)) return true;
    if (isWalletDepositContract(chainId, address)) return true;
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
    ethereumTokens = lastKnownTokens(ETHEREUM_CHAIN_ID);
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
    baseTokens = lastKnownTokens(BASE_CHAIN_ID);
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
    fuseTokens = lastKnownTokens(FUSE_CHAIN_ID);
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
    polygonTokens = lastKnownTokens(POLYGON_CHAIN_ID);
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
    arbitrumTokens = lastKnownTokens(ARBITRUM_CHAIN_ID);
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
    bscTokens = lastKnownTokens(BSC_CHAIN_ID);
  }

  // Process Optimism tokens
  if (optimismResponse.status === PromiseStatus.FULFILLED) {
    optimismTokens = optimismResponse.value
      .filter(
        item =>
          item.token.type === TokenType.ERC20 &&
          filterTokenList(tokenListData, OPTIMISM_CHAIN_ID, getAddress(item)),
      )
      .map(item => convertBlockscoutToTokenBalance(item, OPTIMISM_CHAIN_ID));
  } else {
    console.warn('Failed to fetch Optimism balances:', optimismResponse.reason);
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

  if (polygonBalance.status === PromiseStatus.FULFILLED && Number(polygonBalance.value)) {
    const polygonPriceValue =
      polygonPrice.status === PromiseStatus.FULFILLED ? Number(polygonPrice.value) : 0;
    const polygonPolTokenFromList = tokenListData.find(
      token => token.chainId === POLYGON_CHAIN_ID && token.symbol === 'POL',
    );
    polygonTokens.push({
      contractTickerSymbol: 'POL',
      contractName: 'POL',
      contractAddress: zeroAddress,
      balance: polygonBalance.value.toString(),
      quoteRate: polygonPriceValue,
      contractDecimals: 18,
      type: TokenType.NATIVE,
      verified: true,
      chainId: POLYGON_CHAIN_ID,
      commonId: polygonPolTokenFromList?.commonId,
      tokenId: polygonPolTokenFromList?.tokenId,
    });
  }

  if (optimismBalance.status === PromiseStatus.FULFILLED && Number(optimismBalance.value)) {
    const optimismPriceValue =
      optimismPrice.status === PromiseStatus.FULFILLED ? Number(optimismPrice.value) : 0;
    const optimismEthTokenFromList = tokenListData.find(
      token => token.chainId === OPTIMISM_CHAIN_ID && token.symbol === 'ETH',
    );
    optimismTokens.push({
      contractTickerSymbol: 'ETH',
      contractName: 'Ether',
      contractAddress: zeroAddress,
      balance: optimismBalance.value.toString(),
      quoteRate: optimismPriceValue,
      contractDecimals: 18,
      type: TokenType.NATIVE,
      verified: true,
      chainId: OPTIMISM_CHAIN_ID,
      commonId: optimismEthTokenFromList?.commonId,
      tokenId: optimismEthTokenFromList?.tokenId,
    });
  }

  let allTokens = [
    ...ethereumTokens,
    ...fuseTokens,
    ...polygonTokens,
    ...baseTokens,
    ...arbitrumTokens,
    ...bscTokens,
    ...optimismTokens,
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

  // Fallback 2: CoinGecko by coin id (tokenId for ERC20, NATIVE_COINGECKO_TOKENS for
  // native), from the backend's shared cache: the app holds no CoinGecko key.
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
      const priceById = await fetchCoinPricesById(coinIds);
      allTokens = allTokens.map(t => {
        if (!isZeroRate(t.quoteRate) || isUnderlyingPricedShare(t.contractAddress)) return t;
        const id = t.type === TokenType.NATIVE ? NATIVE_COINGECKO_TOKENS[t.chainId] : t.tokenId;
        const usd = id ? priceById[id] : undefined;
        if (usd != null && usd > 0) return { ...t, quoteRate: usd };
        return t;
      });
    } catch (e) {
      console.warn('CoinGecko fallback price failed:', e);
    }
  }

  // Fallback 3: Alchemy by symbol for tokens still at 0 (no tokenId). One
  // request carries up to 25 symbols; this used to be a request per symbol.
  const stillZero = allTokens.filter(
    t =>
      isZeroRate(t.quoteRate) &&
      t.contractTickerSymbol &&
      !isUnderlyingPricedShare(t.contractAddress),
  );
  const symbolsToFetch = [...new Set(stillZero.map(t => t.contractTickerSymbol))];
  if (symbolsToFetch.length > 0) {
    const symbolToPrice = await fetchTokenPricesBySymbol(symbolsToFetch);
    allTokens = allTokens.map(t => {
      if (!isZeroRate(t.quoteRate) || isUnderlyingPricedShare(t.contractAddress)) return t;
      const p = t.contractTickerSymbol && symbolToPrice[t.contractTickerSymbol];
      if (typeof p === 'number') return { ...t, quoteRate: p };
      return t;
    });
  }

  // Prices read this poll are stamped now. A carried chain's rows still hold the price of the
  // read they came from, so they keep that read's stamp.
  allTokens.forEach(t => {
    if (isZeroRate(t.quoteRate)) return;
    const key = priceKey(t);
    const readAt = carriedPriceKeys.has(key) ? previous?.priceReadAt?.[key] : now;
    if (readAt !== undefined) priceReadAt[key] = readAt;
  });

  // Last resort: a token every lookup above left unpriced keeps the price it had on the last
  // good read, for up to CARRY_OVER_MAX_AGE_MS. Without it, one failed lookup valued EURC at $0
  // for that poll and the card's spendable figure dropped to the dollar balance alone. Shares
  // priced off their own rate are left alone, as above.
  const previousRate = new Map(
    (previous?.tokens ?? [])
      .filter(t => !isZeroRate(t.quoteRate))
      .map(t => [priceKey(t), t.quoteRate]),
  );
  allTokens = allTokens.map(t => {
    if (!isZeroRate(t.quoteRate) || isUnderlyingPricedShare(t.contractAddress)) return t;
    const key = priceKey(t);
    const readAt = previous?.priceReadAt?.[key];
    const rate = previousRate.get(key);
    if (!rate || !isFresh(readAt)) return t;
    priceReadAt[key] = readAt;
    return { ...t, quoteRate: rate };
  });

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
  const optimismTokensFinal = allTokens.filter(t => t.chainId === OPTIMISM_CHAIN_ID);

  for (const [chainId, response] of [
    [BASE_CHAIN_ID, baseResponse],
    [ETHEREUM_CHAIN_ID, ethereumResponse],
    [FUSE_CHAIN_ID, fuseResponse],
    [POLYGON_CHAIN_ID, polygonResponse],
    [ARBITRUM_CHAIN_ID, arbitrumResponse],
    [BSC_CHAIN_ID, bscResponse],
  ] as const) {
    if (response.status === PromiseStatus.FULFILLED) chainReadAt[chainId] = now;
  }

  return {
    ...totals,
    chainReadAt,
    priceReadAt,
    failedChainIds: Array.from(
      new Set(
        [
          [BASE_CHAIN_ID, baseResponse],
          [ETHEREUM_CHAIN_ID, ethereumResponse],
          [FUSE_CHAIN_ID, fuseResponse],
          [POLYGON_CHAIN_ID, polygonResponse],
          [ARBITRUM_CHAIN_ID, arbitrumResponse],
          [BSC_CHAIN_ID, bscResponse],
          [OPTIMISM_CHAIN_ID, optimismResponse],
          [ETHEREUM_CHAIN_ID, ethBalance],
          [FUSE_CHAIN_ID, fuseBalance],
          [BASE_CHAIN_ID, baseBalance],
          [ARBITRUM_CHAIN_ID, arbitrumBalance],
          [BSC_CHAIN_ID, bscBalance],
          [POLYGON_CHAIN_ID, polygonBalance],
          [OPTIMISM_CHAIN_ID, optimismBalance],
        ]
          .filter(([, result]) => (result as PromiseSettledResult<unknown>).status === 'rejected')
          .map(([chainId]) => chainId as number),
      ),
    ),
    ethereumTokens: ethereumTokensFinal,
    fuseTokens: fuseTokensFinal,
    polygonTokens: polygonTokensFinal,
    baseTokens: baseTokensFinal,
    arbitrumTokens: arbitrumTokensFinal,
    bscTokens: bscTokensFinal,
    optimismTokens: optimismTokensFinal,
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
  failedChainIds: [] as number[],
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
  optimismTokens: [] as TokenBalance[],
  tokens: [] as TokenBalance[],
  unifiedTokens: [] as UnifiedTokenBalance[],
};

/** Shared by useBalances and the protected layout's prefetch. */
export const tokenBalancesQueryOptions = (safeAddress: string | undefined) => ({
  queryKey: ['tokenBalances', safeAddress],
  queryFn: ({ client, queryKey }: QueryFunctionContext) =>
    fetchTokenBalances(safeAddress!, client.getQueryData<PreviousBalances>(queryKey)),
  enabled: !!safeAddress,
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
});

/**
 * The realtime socket handles live updates (lib/realtime refreshes
 * ['tokenBalances'] on every balance event); polling is the fallback for missed
 * events or a dropped socket. The price lookups inside a refresh are cached for
 * a minute, so this interval doesn't drive Prices API usage.
 */
const BALANCES_POLL_INTERVAL_MS = 5_000;

export const useBalances = (): BalanceData => {
  const { user } = useUser();

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    ...tokenBalancesQueryOptions(user?.safeAddress),
    staleTime: 5_000,
    retry: 3, // retry up to 3 times on failure
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchOnWindowFocus: true, // refetch when user returns to tab
    refetchOnReconnect: true, // refetch when network reconnects
    refetchInterval: BALANCES_POLL_INTERVAL_MS,
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
