import { ImageSourcePropType } from 'react-native';
import { formatUnits, parseUnits } from 'viem';
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

/**
 * Who the screen is for: their card issuer, and whether they are offered the
 * deposit tokens still being rolled out (`useDepositTokensAccess`). Without
 * `hasNewTokens` only what every user is offered is listed (see `releasedOn`),
 * so a caller that leaves it out shows less rather than more.
 */
export type WalletDepositViewer = {
  provider?: WalletDepositProvider;
  hasNewTokens?: boolean;
};

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
const MINIMUM_DEPOSIT_BY_CHAIN: Record<number, string> = {
  [mainnet.id]: '10',
  [polygon.id]: '1',
  [base.id]: '1',
  [arbitrum.id]: '1',
  [optimism.id]: '1',
  [bsc.id]: '1',
  [fuse.id]: '1',
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
const MINIMUM_DEPOSIT_BY_TOKEN: Record<string, string> = {
  ETH: '0.005',
  WETH: '0.005',
  FUSE: '500',
  WFUSE: '500',
  WBTC: '0.00015',
  cbBTC: '0.00015',
  cbZEC: '0.01',
  AAVE: '0.07',
  SOL: '0.1',
};

/** Used for a chain with no entry above, rather than claiming there is no floor. */
const DEFAULT_MINIMUM_DEPOSIT = '1';

/**
 * The precision a minimum is carried at, in token units. Every amount here is a
 * decimal string turned into this many units with viem, never a float: the
 * figure is the floor below which a deposit is not credited, so rounding it the
 * wrong way is a quoted floor under the real one.
 */
const MINIMUM_PRECISION = 18;

/** Whether a published minimum is a usable, positive decimal ("0.004", not "n/a" or "0"). */
const isPositiveAmount = (value: string): boolean => {
  try {
    return parseUnits(value, MINIMUM_PRECISION) > 0n;
  } catch {
    return false;
  }
};

/** The stablecoins the deposit pipeline has a route for. */
const DIRECT_DEPOSIT_SYMBOLS = new Set(['USDC', 'USDT', 'EURC']);

/** EURC, which only a Wirex cardholder is offered. */
const EURC_SYMBOL = 'EURC';

/**
 * The chain the screen opens on, and that every currency it carries opens on.
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
const isOffered = (token: WalletDepositTokenConfig, provider: WalletDepositProvider): boolean =>
  token.symbol !== EURC_SYMBOL || offersWalletDepositEurc(provider);

const isOpenChain = (chainId: number): boolean => !getBridgeChain(chainId)?.isComingSoon;

/** Whether everyone is offered the currency on this chain, not only those with access. */
const isReleasedOn = (token: WalletDepositTokenConfig, chainId: number): boolean =>
  token.releasedOn?.includes(chainId) ?? false;

/** The chains a currency is taken on for this person, in "Select network" order. */
const getTokenChainIds = (
  token: WalletDepositTokenConfig,
  { provider, hasNewTokens = false }: WalletDepositViewer,
): number[] => {
  if (!isOffered(token, provider)) return [];
  const minted = usesDirectDepositAddress(token.symbol, provider);

  return WALLET_DEPOSIT_CHAIN_IDS.filter(
    chainId =>
      token.contracts[chainId] !== undefined &&
      isOpenChain(chainId) &&
      (hasNewTokens || isReleasedOn(token, chainId)) &&
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
  viewer: WalletDepositViewer = {},
): WalletDepositToken[] =>
  WALLET_DEPOSIT_TOKENS.filter(token => getTokenChainIds(token, viewer).includes(chainId)).map(
    toWalletDepositToken,
  );

/**
 * Chains the wallet can be funded on, in display order.
 *
 * The deposit address is the user's Safe, which is the same address on every
 * chain — the choice here only decides which currencies are on offer, what the
 * minimum is, and which logo the QR carries.
 *
 * With a viewer, only the chains carrying something offered to them; without
 * one, every chain, for looking a chain's name and logo up.
 */
export const getWalletDepositNetworks = (viewer?: WalletDepositViewer): WalletDepositNetwork[] =>
  WALLET_DEPOSIT_CHAIN_IDS.filter(
    chainId =>
      isOpenChain(chainId) &&
      WALLET_DEPOSIT_TOKENS.some(token =>
        viewer
          ? getTokenChainIds(token, viewer).includes(chainId)
          : token.contracts[chainId] !== undefined,
      ),
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
  viewer: WalletDepositViewer = {},
): string | undefined => {
  const tokens = getWalletDepositTokens(chainId, viewer);
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
export const getWalletDepositMinimum = (chainId: number, symbol: string): string =>
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
): string => {
  const publishedFor = (wanted: string) =>
    assets?.find(asset => asset.chainId === chainId && asset.symbol === wanted);
  const published = publishedFor(WRAPPED_EQUIVALENT[symbol] ?? symbol) ?? publishedFor(symbol);

  // Kept as the string the backend sent, so no float stands between its floor
  // and the one printed.
  return published && isPositiveAmount(published.minimum)
    ? published.minimum
    : getWalletDepositMinimum(chainId, symbol);
};

/**
 * A minimum as the screen prints it: two significant figures for an asset worth
 * thousands a unit (0.00012 WBTC), never fewer than four decimals, and rounded
 * up, so the floor quoted is never below the one it stands for. In bigint
 * units, so nothing is lost on the way.
 */
export const formatWalletDepositMinimum = (minimum: string): string => {
  const units = parseUnits(minimum, MINIMUM_PRECISION);
  const one = 10n ** BigInt(MINIMUM_PRECISION);
  // Zeros between the point and the first significant digit: 3 for 0.0001194.
  const leadingZeros = units > 0n && units < one ? MINIMUM_PRECISION - units.toString().length : 0;
  const decimals = Math.min(Math.max(4, leadingZeros + 2), MINIMUM_PRECISION);
  const step = 10n ** BigInt(MINIMUM_PRECISION - decimals);
  const roundedUp = ((units + step - 1n) / step) * step;

  const [whole, fraction] = formatUnits(roundedUp, MINIMUM_PRECISION).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
};

/**
 * The pairing the screen opens on: USDC on Base (see
 * `DEFAULT_WALLET_DEPOSIT_CHAIN_ID`), falling back if either is off. Both are
 * offered to everyone, so this needs no viewer.
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
 * lists them: the stablecoins, then ETH and the rest, with the wrapped natives
 * last.
 */
export const getAllWalletDepositTokens = (viewer: WalletDepositViewer = {}): WalletDepositToken[] =>
  WALLET_DEPOSIT_TOKENS.filter(token => getTokenChainIds(token, viewer).length > 0).map(
    toWalletDepositToken,
  );

/**
 * Whether a currency answers a search: by ticker or by name, so "btc" finds WBTC
 * and cbBTC, plus the aliases a person might type instead ("bitcoin", "zcash").
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
  viewer: WalletDepositViewer = {},
): WalletDepositNetwork[] => {
  const networks = getWalletDepositNetworks(viewer);
  const token = findToken(symbol);
  const carrying = token ? getTokenChainIds(token, viewer) : [];
  const offered = networks.filter(network => carrying.includes(network.chainId));

  return offered.length ? offered : networks;
};

/**
 * The chain the address opens on once `symbol` is picked.
 *
 * The current chain when it carries the currency, so changing only the currency
 * from the address screen keeps the chain. Otherwise the default chain (see
 * `getDefaultWalletDepositSelection`) if it carries it, else the first that does.
 */
export const resolveWalletDepositChain = (
  symbol: string,
  currentChainId?: number,
  viewer: WalletDepositViewer = {},
): number => {
  const carrying = getWalletDepositNetworksForToken(symbol, viewer).map(network => network.chainId);
  if (currentChainId !== undefined && carrying.includes(currentChainId)) return currentChainId;

  const { chainId: defaultChainId } = getDefaultWalletDepositSelection();
  return carrying.includes(defaultChainId) ? defaultChainId : (carrying[0] ?? defaultChainId);
};
