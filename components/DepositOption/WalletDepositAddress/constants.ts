import { ImageSourcePropType } from 'react-native';
import { arbitrum, base, bsc, fuse, mainnet, optimism, polygon } from 'viem/chains';

import { BRIDGE_TOKENS, getBridgeChain } from '@/constants/bridge';
import {
  WALLET_DEPOSIT_CHAIN_IDS,
  WALLET_DEPOSIT_TOKEN_GROUPS,
  WALLET_DEPOSIT_TOKENS,
  WalletDepositTokenConfig,
  WalletDepositTokenGroup,
} from '@/constants/walletDepositTokens';
import { getAsset } from '@/lib/assets';
import { isDevFeatureEnabled } from '@/lib/config';
import { CardProvider, DepositAsset } from '@/lib/types';

export type WalletDepositNetwork = {
  chainId: number;
  name: string;
  icon: ImageSourcePropType;
};

export type WalletDepositToken = {
  symbol: string;
  name: string;
  group: WalletDepositTokenGroup;
  icon: ImageSourcePropType;
};

/** Who the screen is for, which decides EURC and where stablecoins go. */
type WalletDepositProvider = CardProvider | null | undefined;

/** Deposits land on the Safe within roughly the same window on every chain. */
export const WALLET_DEPOSIT_ESTIMATED_TIME = '~3 min';

export const WALLET_DEPOSIT_LEARN_URL =
  'https://support.solid.xyz/en/articles/14431132-supported-networks-and-tokens-on-solid';

/**
 * Smallest deposit worth sending, in token units, per chain.
 *
 * A transfer to the deposit address is picked up and credited by a backend leg
 * that pays gas on the source chain, so anything under the floor costs more to
 * move than it is worth and is neither credited nor returned — which is what the
 * warning under the QR is telling the user. Ethereum's gas is why its floor is an
 * order of magnitude above every other chain's.
 *
 * These are the single source of truth for the minimum shown on the deposit
 * address screen; change them here rather than in the copy.
 */
const MINIMUM_DEPOSIT_BY_CHAIN: Record<number, number> = {
  [mainnet.id]: 10,
  [polygon.id]: 1,
  [base.id]: 1,
  [arbitrum.id]: 1,
  [optimism.id]: 1,
  [bsc.id]: 1,
  [fuse.id]: 1,
};

/**
 * Overrides for the assets that are not worth ~$1 a unit, so every floor lands in
 * roughly the same place in dollars — about $10, rounded up. Keyed by symbol
 * alone: ETH and WETH are the same asset on Ethereum and Base, and the pipeline
 * floors them at one dollar figure on every chain.
 *
 * Only shown until the backend's priced minimum arrives (see
 * `resolveWalletDepositMinimum`), so these round up: overstating a floor turns
 * away a deposit that would have counted, understating one strands it.
 */
const MINIMUM_DEPOSIT_BY_TOKEN: Record<string, number> = {
  ETH: 0.005,
  WETH: 0.005,
  FUSE: 500,
  WFUSE: 500,
  PAXG: 0.003,
  SLVx: 0.2,
  WBTC: 0.00015,
  cbBTC: 0.00015,
  ZEC: 0.01,
  UNI: 1.5,
  NEAR: 2,
  ENA: 50,
  AAVE: 0.07,
  SOL: 0.1,
  WLD: 20,
  ARB: 60,
  OP: 80,
};

/** Used for a chain with no entry above, rather than claiming there is no floor. */
const DEFAULT_MINIMUM_DEPOSIT = 1;

/** The stablecoins the deposit pipeline has a route for. */
const DIRECT_DEPOSIT_SYMBOLS = new Set(['USDC', 'USDT', 'EURC']);

/** EURC, which only a Wirex cardholder is offered. */
const EURC_SYMBOL = 'EURC';

/**
 * The chain the screen opens on, and that every currency it carries opens on
 * unless it has a home of its own (see `homeChainId`).
 *
 * Base because it carries nearly every currency on offer, and sending there
 * costs a fraction of Ethereum's gas. FUSE and WFUSE exist on Fuse alone, so
 * they open there.
 */
const DEFAULT_WALLET_DEPOSIT_CHAIN_ID = base.id;

/**
 * Whether the screen offers EURC at all: to Wirex cardholders only.
 *
 * The pipeline delivers it as EURC to their Safe on Base, the balance the Base
 * spend-module instance sells for euro purchases. For anyone else it would be
 * a balance nothing spends, so they are not offered it.
 */
export const offersWalletDepositEurc = (provider: WalletDepositProvider): boolean =>
  provider === CardProvider.WIREX;

/**
 * Whether the deposit address is one the pipeline mints, rather than the Safe.
 *
 * Both halves have to hold:
 *
 * - A Wirex cardholder. The address is minted against the card destination, and
 *   the backend resolves that by issuer: for Wirex it delivers to their Safe on
 *   Fuse, which is the same balance their card settles from. For a Rain
 *   cardholder it would deliver to the card, and for someone with no card there
 *   is no issuer to resolve — so everyone else is shown the Safe, everywhere.
 * - A stablecoin. EURC counts: for it the pipeline delivers to their Safe on
 *   Base instead, where the card's euro balance is spent from.
 *   Everything else has no route through the pipeline; it lands in the Safe and
 *   stays as the token that was sent, so there the Safe address is the right
 *   answer rather than a fallback.
 */
export const usesDirectDepositAddress = (
  symbol: string,
  provider: WalletDepositProvider,
): boolean => provider === CardProvider.WIREX && DIRECT_DEPOSIT_SYMBOLS.has(symbol);

/**
 * Whether the pipeline can mint an address on a chain: the bridge sources, the
 * chains it watches. Optimism is a deposit chain for the Safe only, so a Wirex
 * cardholder's stablecoins — which always go through the pipeline — are not
 * offered there.
 */
const isDirectDepositChain = (chainId: number): boolean =>
  !!BRIDGE_TOKENS[chainId] && !BRIDGE_TOKENS[chainId].isComingSoon;

/**
 * The contract the pipeline credits for a native asset. It lists WETH and WFUSE;
 * the deposit screen offers ETH and FUSE, which are the same floor.
 */
const WRAPPED_EQUIVALENT: Record<string, string> = {
  ETH: 'WETH',
  FUSE: 'WFUSE',
};

const findToken = (symbol?: string): WalletDepositTokenConfig | undefined =>
  WALLET_DEPOSIT_TOKENS.find(token => token.symbol === symbol);

/** Whether a currency is on offer to this person at all, on any chain. */
const isOffered = (token: WalletDepositTokenConfig, provider: WalletDepositProvider): boolean => {
  if (token.devOnly && !isDevFeatureEnabled) return false;
  if (token.symbol === EURC_SYMBOL) return offersWalletDepositEurc(provider);
  return true;
};

const isOpenChain = (chainId: number): boolean => !getBridgeChain(chainId)?.isComingSoon;

/** The chains a currency is taken on for this person, in "Select network" order. */
const getTokenChainIds = (
  token: WalletDepositTokenConfig,
  provider: WalletDepositProvider,
): number[] => {
  if (!isOffered(token, provider)) return [];
  const minted = usesDirectDepositAddress(token.symbol, provider);

  return WALLET_DEPOSIT_CHAIN_IDS.filter(
    chainId =>
      token.contracts[chainId] !== undefined &&
      isOpenChain(chainId) &&
      (!minted || isDirectDepositChain(chainId)),
  );
};

const toWalletDepositToken = ({
  symbol,
  name,
  group,
  icon,
}: WalletDepositTokenConfig): WalletDepositToken => ({
  symbol,
  name,
  group,
  icon: getAsset(icon),
});

/** The currency's icon, wherever it is drawn: the row, the pill, the minimum line. */
export const getWalletDepositTokenIcon = (symbol: string): ImageSourcePropType =>
  getAsset(findToken(symbol)?.icon ?? 'images/usdc-4x.png');

/** The currencies that chain accepts for this person, in "Select token" order. */
export const getWalletDepositTokens = (
  chainId: number,
  provider?: WalletDepositProvider,
): WalletDepositToken[] =>
  WALLET_DEPOSIT_TOKENS.filter(token => getTokenChainIds(token, provider).includes(chainId)).map(
    toWalletDepositToken,
  );

/**
 * Chains the wallet can be funded on, in display order.
 *
 * The deposit address is the user's Safe, which is the same address on every
 * chain — the choice here only decides which currencies are on offer, what the
 * minimum is, and which logo the QR carries.
 */
export const getWalletDepositNetworks = (): WalletDepositNetwork[] =>
  WALLET_DEPOSIT_CHAIN_IDS.filter(
    chainId =>
      isOpenChain(chainId) &&
      WALLET_DEPOSIT_TOKENS.some(token => token.contracts[chainId] !== undefined),
  ).flatMap(chainId => {
    const chain = getBridgeChain(chainId);
    return chain ? [{ chainId, name: chain.name, icon: chain.icon }] : [];
  });

/**
 * The currency to show once `chainId` is chosen.
 *
 * A currency carries over between chains when the new one accepts it, so picking
 * a chain does not silently reset a deliberate choice. When it does not — ETH
 * is not offered on Polygon, FUSE only exists on Fuse — it falls back to what
 * the chain does carry, rather than leaving the screen quoting a minimum for a
 * pairing that does not exist.
 */
export const resolveWalletDepositSymbol = (
  chainId: number,
  symbol?: string,
  provider?: WalletDepositProvider,
): string | undefined => {
  const tokens = getWalletDepositTokens(chainId, provider);
  return tokens.some(token => token.symbol === symbol) ? symbol : tokens[0]?.symbol;
};

/**
 * The committed estimate, used when the pipeline has not answered.
 *
 * Kept as the fallback rather than deleted: a screen that shows no minimum while
 * a request is in flight, or when it fails, is worse than one showing an
 * approximate figure immediately. `resolveWalletDepositMinimum` prefers the
 * live number whenever there is one.
 */
export const getWalletDepositMinimum = (chainId: number, symbol: string): number =>
  MINIMUM_DEPOSIT_BY_TOKEN[symbol] ?? MINIMUM_DEPOSIT_BY_CHAIN[chainId] ?? DEFAULT_MINIMUM_DEPOSIT;

/**
 * The minimum to show for a pairing, preferring what the deposit pipeline says.
 *
 * The pipeline's figure is the only one that is enforced, and it is derived from
 * a dollar floor at a price the backend controls — so quoting it is the only way
 * the screen and the service cannot disagree. `assets` being absent (loading,
 * failed, or an older backend) falls back to the committed table.
 *
 * Native assets are matched through their wrapped equivalents: the pipeline
 * credits WETH and WFUSE contracts, while the screen offers ETH and FUSE, and
 * the floor is the same either way. Where a chain has no wrapped contract to
 * publish — ETH on BNB Chain is itself a token — its own symbol is used.
 */
export const resolveWalletDepositMinimum = (
  chainId: number,
  symbol: string,
  assets?: DepositAsset[],
): number => {
  const publishedFor = (wanted: string) =>
    assets?.find(asset => asset.chainId === chainId && asset.symbol === wanted);
  const published = publishedFor(WRAPPED_EQUIVALENT[symbol] ?? symbol) ?? publishedFor(symbol);
  const parsed = published ? Number(published.minimum) : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : getWalletDepositMinimum(chainId, symbol);
};

/**
 * A minimum as the screen prints it: two significant figures for an asset worth
 * thousands a unit (0.00012 WBTC), never fewer than four decimals, and rounded
 * up, so the floor quoted is never below the one it stands for.
 */
export const formatWalletDepositMinimum = (minimum: number): string => {
  const leadingZeros = minimum > 0 && minimum < 1 ? Math.floor(-Math.log10(minimum)) : 0;
  const decimals = Math.min(Math.max(4, leadingZeros + 2), 18);
  const factor = 10 ** decimals;
  // The tolerance keeps float noise (0.005 * 1e4 = 50.000000000000007) from
  // rounding a floor that is already exact up by one step.
  const roundedUp = Math.ceil(minimum * factor - 1e-6) / factor;
  return new Intl.NumberFormat('en-us', { maximumFractionDigits: decimals }).format(roundedUp);
};

/**
 * The pairing the screen opens on: USDC on Base (see
 * `DEFAULT_WALLET_DEPOSIT_CHAIN_ID`), falling back if either is off.
 *
 * This address is the user's Safe on the chain they pick, not a bridge — what
 * lands on Base stays on Base. A Wirex cardholder's USDC and USDT are the
 * exception: they go to a minted address, which delivers them to the Safe on
 * Fuse, with the fee for that bridge quoted under the QR.
 */
export const getDefaultWalletDepositSelection = (): { chainId: number; symbol: string } => {
  const networks = getWalletDepositNetworks();
  const chainId = networks.some(network => network.chainId === DEFAULT_WALLET_DEPOSIT_CHAIN_ID)
    ? DEFAULT_WALLET_DEPOSIT_CHAIN_ID
    : (networks[0]?.chainId ?? mainnet.id);
  const tokens = getWalletDepositTokens(chainId);
  const symbol =
    tokens.find(token => token.symbol === 'USDC')?.symbol ?? tokens[0]?.symbol ?? 'USDC';

  return { chainId, symbol };
};

/**
 * Every currency the deposit address can take, each once, for "Select token" —
 * the first step, taken before any chain is chosen. In the order the design
 * lists them: the stablecoins, gold and silver, then ETH and the rest, with the
 * wrapped natives last.
 */
export const getAllWalletDepositTokens = (provider?: WalletDepositProvider): WalletDepositToken[] =>
  WALLET_DEPOSIT_TOKENS.filter(token => getTokenChainIds(token, provider).length > 0).map(
    toWalletDepositToken,
  );

/**
 * Whether a currency answers a search: by ticker or by name, so "btc" finds WBTC
 * and cbBTC and "gold" finds PAXG, plus the aliases a person might type instead
 * ("bitcoin", "paxos").
 */
export const matchesWalletDepositSearch = (token: WalletDepositToken, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const aliases = findToken(token.symbol)?.aliases ?? [];
  return [token.symbol, token.name, ...aliases].some(text => text.toLowerCase().includes(needle));
};

/** The currencies under their group headings, leaving out a group with none. */
export const groupWalletDepositTokens = (
  tokens: WalletDepositToken[],
): { key: WalletDepositTokenGroup; label: string; tokens: WalletDepositToken[] }[] =>
  WALLET_DEPOSIT_TOKEN_GROUPS.map(group => ({
    ...group,
    tokens: tokens.filter(token => token.group === group.key),
  })).filter(group => group.tokens.length > 0);

/**
 * The chains "Select network" offers once a currency is chosen: only those that
 * carry it, so switching chain can never quietly switch the currency too. All of
 * them when nothing is chosen yet, or no chain carries it.
 */
export const getWalletDepositNetworksForToken = (
  symbol?: string,
  provider?: WalletDepositProvider,
): WalletDepositNetwork[] => {
  const networks = getWalletDepositNetworks();
  const token = findToken(symbol);
  const carrying = token ? getTokenChainIds(token, provider) : [];
  const offered = networks.filter(network => carrying.includes(network.chainId));

  return offered.length ? offered : networks;
};

/**
 * The chain the address opens on once `symbol` is picked.
 *
 * The current chain when it carries the currency, so changing only the currency
 * from the address screen keeps the chain. Otherwise the currency's own home
 * (ARB on Arbitrum, OP on Optimism), then the default chain (see
 * `getDefaultWalletDepositSelection`) if it carries it, else the first that does.
 */
export const resolveWalletDepositChain = (
  symbol: string,
  currentChainId?: number,
  provider?: WalletDepositProvider,
): number => {
  const carrying = getWalletDepositNetworksForToken(symbol, provider).map(
    network => network.chainId,
  );
  if (currentChainId !== undefined && carrying.includes(currentChainId)) return currentChainId;

  const homeChainId = findToken(symbol)?.homeChainId;
  if (homeChainId !== undefined && carrying.includes(homeChainId)) return homeChainId;

  const { chainId: defaultChainId } = getDefaultWalletDepositSelection();
  return carrying.includes(defaultChainId) ? defaultChainId : (carrying[0] ?? defaultChainId);
};
