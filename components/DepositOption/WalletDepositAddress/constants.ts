import { ImageSourcePropType } from 'react-native';
import { formatUnits, parseUnits } from 'viem';
import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { BRIDGE_TOKENS, getBridgeChain } from '@/constants/bridge';
import {
  WALLET_DEPOSIT_CHAIN_IDS,
  WALLET_DEPOSIT_TOKEN_GROUPS,
  WALLET_DEPOSIT_TOKENS,
  WalletDepositTokenConfig,
  WalletDepositTokenGroup,
} from '@/constants/walletDepositTokens';
import { getAsset } from '@/lib/assets';
import {
  findRhinoRouteForRow,
  getRhinoExtraChains,
  getRhinoExtraSelection,
  getRhinoSelectionForRow,
  isOfferedRhinoRow,
  isOwnPipelineChain,
  resolveRhinoRow,
  RhinoAssetsState,
  RhinoDepositSelection,
  RhinoRowState,
} from '@/lib/rhinoDeposit';
import {
  CardProvider,
  DepositAsset,
  RhinoDepositAssetsResponse,
  RhinoDepositChain,
} from '@/lib/types';

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

/** Who the screen is for, which decides where stablecoins go. */
type WalletDepositProvider = CardProvider | null | undefined;

/**
 * Who the screen is for, and what rhino.fi offers them: their card issuer,
 * whether they are offered the deposit tokens still being rolled out
 * (`useDepositTokensAccess`), and rhino.fi's routes, which decide every row but
 * Fuse's. Without `hasNewTokens` only what every user is offered is listed (see
 * `releasedOn`); without `rhino` the routes count as still loading, so only the
 * Fuse rows are offered. A caller that leaves either out shows less, not more.
 */
export type WalletDepositViewer = {
  provider?: WalletDepositProvider;
  hasNewTokens?: boolean;
  rhino?: RhinoAssetsState;
};

/** How one row of the screen is served (see `getWalletDepositRow`). */
export type WalletDepositRow = RhinoRowState;

const RHINO_LOADING: RhinoAssetsState = { status: 'loading' };

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
  BTC: '0.00015',
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

/**
 * The stablecoins a Wirex cardholder's Fuse deposit goes to their card address
 * for, which our pipeline delivers to the Safe on Fuse their card spends from.
 * Off Fuse their dollars take the wallet's routes like everyone's.
 */
const CARD_ADDRESS_SYMBOLS: ReadonlySet<string> = new Set(['USDC', 'USDT']);

/** The rhino.fi route every wallet row is matched against: the Safe on Base. */
const WALLET_RHINO_DESTINATION = 'WALLET' as const;

/** Base's own coin, which only our wallet deposit address there wraps. */
const NATIVE_ETH_SYMBOL = 'ETH';

/**
 * The chains our own pipeline bridges a wallet deposit's USDC and USDT to the
 * Safe on Base from (the backend's `WALLET_BRIDGE_SOURCE_CHAINS`), and so the
 * chains a `WALLET` session is offered on while rhino.fi is off.
 */
const WALLET_SESSION_CHAIN_IDS: ReadonlySet<number> = new Set([
  mainnet.id,
  polygon.id,
  arbitrum.id,
  bsc.id,
]);

/**
 * The chain the screen opens on, and that every currency it carries opens on.
 *
 * Base because it carries nearly every currency on offer, and sending there
 * costs a fraction of Ethereum's gas. FUSE and WFUSE exist on Fuse alone, so
 * they open there.
 */
const DEFAULT_WALLET_DEPOSIT_CHAIN_ID = base.id;

/**
 * The address a wallet row of our own pipeline shows: a direct-deposit session
 * the pipeline mints and watches (for `destinationType`), or the Safe itself.
 */
export type WalletOwnAddress =
  | { kind: 'session'; destinationType: 'WALLET' | 'RAIN_CARD' }
  | { kind: 'safe' };

/**
 * The address of a wallet row our own pipeline serves (see `getWalletDepositRow`),
 * or undefined where it has none to give — the row is then not offered.
 *
 * - Fuse, which rhino.fi does not support, keeps what it always showed: a Wirex
 *   cardholder's dollar stablecoins go to an address minted against the card
 *   destination (`RAIN_CARD`), which for Wirex delivers to their Safe on Fuse,
 *   the balance their card settles from; everything else (FUSE and WFUSE, and
 *   anyone else's dollars) is the Safe, where it lands as sent. For a Rain
 *   cardholder that address would deliver to the card, and for someone with no
 *   card there is no issuer to resolve, which is why it is Wirex's alone.
 * - Base, where every wallet deposit ends up: our own, never rhino.fi, which
 *   would only pay it back to Base (`isOwnPayoutChain`). The Safe, where it
 *   lands as sent; ETH alone goes to our wallet deposit address there (a
 *   `WALLET` session), which wraps it into the WETH the card spends.
 * - While the backend has rhino.fi off (`rhinoOff`): the dollar stablecoins on
 *   the chains the backend bridges them to Base from, as a `WALLET` session it
 *   delivers to the Safe on Base (see {@link WALLET_SESSION_CHAIN_IDS}); Wirex
 *   cardholders included, whose card spends from that Safe. Nothing elsewhere:
 *   such a deposit would stay on the chain it was sent on.
 * - Any other row is rhino.fi's, USDT included (paid to the Safe as USDC), so
 *   there is no address of ours to give.
 */
export const getWalletOwnAddress = (
  chainId: number,
  symbol: string,
  provider: WalletDepositProvider,
  { rhinoOff = false }: { rhinoOff?: boolean } = {},
): WalletOwnAddress | undefined => {
  if (isOwnPipelineChain(chainId)) {
    return provider === CardProvider.WIREX && CARD_ADDRESS_SYMBOLS.has(symbol)
      ? { kind: 'session', destinationType: 'RAIN_CARD' }
      : { kind: 'safe' };
  }
  if (chainId === base.id) {
    // ETH lands as ETH, which the card cannot spend: our wallet deposit address
    // on Base wraps it and sends WETH on to the Safe.
    return symbol === NATIVE_ETH_SYMBOL
      ? { kind: 'session', destinationType: WALLET_RHINO_DESTINATION }
      : { kind: 'safe' };
  }
  return rhinoOff &&
    CARD_ADDRESS_SYMBOLS.has(symbol) &&
    WALLET_SESSION_CHAIN_IDS.has(chainId) &&
    !!BRIDGE_TOKENS[chainId]?.tokens?.[symbol]
    ? { kind: 'session', destinationType: WALLET_RHINO_DESTINATION }
    : undefined;
};

/**
 * The rhino.fi route a wallet row would take, or undefined where rhino.fi has
 * none (see `getWalletDepositRow` for what such a row becomes, and why Base
 * and Fuse never take it). Always the `WALLET` route, which pays the Safe on
 * Base, a Wirex cardholder's dollars and EURC included: Base is where their
 * deposits land now, off Fuse.
 */
export const getWalletRhinoSelection = (
  assets: RhinoDepositAssetsResponse | undefined,
  chainId: number,
  symbol: string,
): RhinoDepositSelection | undefined =>
  getRhinoSelectionForRow(assets, {
    chainId,
    destinationType: WALLET_RHINO_DESTINATION,
    symbol,
  });

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

/**
 * A currency no chain of the list's own carries, which only "More networks"
 * can offer: native BTC, on Bitcoin.
 */
const isMoreNetworksOnly = (token: WalletDepositTokenConfig): boolean =>
  Object.keys(token.contracts).length === 0;

/**
 * Whether a currency is on offer to this person at all, on any chain. One only
 * "More networks" carries is a new deposit token on every chain it has, so it
 * is offered only with access (see `useDepositTokensAccess`).
 */
const isOffered = (
  token: WalletDepositTokenConfig,
  { hasNewTokens = false }: WalletDepositViewer,
): boolean => !isMoreNetworksOnly(token) || hasNewTokens;

const isOpenChain = (chainId: number): boolean => !getBridgeChain(chainId)?.isComingSoon;

/** Whether everyone is offered the currency on this chain, not only those with access. */
const isReleasedOn = (token: WalletDepositTokenConfig, chainId: number): boolean =>
  token.releasedOn?.includes(chainId) ?? false;

/**
 * The chains a currency could be taken on for this person, in "Select network"
 * order, before rhino.fi has a say: where it has a contract, on an open chain,
 * and released to them.
 */
const getCandidateChainIds = (
  token: WalletDepositTokenConfig,
  viewer: WalletDepositViewer,
): number[] => {
  const { hasNewTokens = false } = viewer;
  if (!isOffered(token, viewer)) return [];

  return WALLET_DEPOSIT_CHAIN_IDS.filter(
    chainId =>
      token.contracts[chainId] !== undefined &&
      isOpenChain(chainId) &&
      (hasNewTokens || isReleasedOn(token, chainId)),
  );
};

/**
 * Each of a currency's candidate rows, and how it is served:
 *
 * - Fuse: our own pipeline, exactly as before (the Safe, or a Wirex
 *   cardholder's minted address — see {@link getWalletOwnAddress}).
 * - Base, where the wallet route pays out: our own, without waiting for
 *   rhino.fi, which would only pay the deposit back to Base
 *   (`isOwnPayoutChain`). The Safe, or for ETH our wallet deposit address
 *   there, which wraps it.
 * - Any other chain rhino.fi takes it into the wallet from: rhino.fi's address,
 *   which pays the Safe on Base (USDT as USDC). A chain it has no route from is
 *   not offered, with no Safe in its place.
 *
 * Until rhino.fi's routes are in, every rhino.fi row is `loading`, and
 * `unavailable` if they cannot be had: which tokens rhino.fi takes is exactly
 * what decides these rows, so none of them can be offered without it. While
 * the backend has rhino.fi off, every row is our own, offered wherever
 * {@link getWalletOwnAddress} has an address: Fuse, every Base row, and USDC
 * and USDT on the chains our pipeline bridges them to Base from.
 */
const getTokenRows = (
  token: WalletDepositTokenConfig,
  viewer: WalletDepositViewer,
): { chainId: number; state: WalletDepositRow }[] => {
  const candidates = getCandidateChainIds(token, viewer);
  const rhino = viewer.rhino ?? RHINO_LOADING;
  const { symbol } = token;
  const destinationType = WALLET_RHINO_DESTINATION;
  const landsInSafeOnBase =
    rhino.status === 'ready' &&
    !candidates.some(
      chainId => !!findRhinoRouteForRow(rhino.assets, { chainId, destinationType, symbol }),
    );

  return candidates.map(chainId => {
    const state = resolveRhinoRow(rhino, { chainId, destinationType, symbol });
    if (state.kind === 'own') {
      // An own row with no address of ours is not offered.
      return getWalletOwnAddress(chainId, symbol, viewer.provider, {
        rhinoOff: rhino.status === 'disabled',
      })
        ? { chainId, state }
        : { chainId, state: { kind: 'none' } };
    }
    return state.kind === 'none' && chainId === base.id && landsInSafeOnBase
      ? { chainId, state: { kind: 'own' } }
      : { chainId, state };
  });
};

/** The chains a currency is offered on for this person, in "Select network" order. */
const getTokenChainIds = (token: WalletDepositTokenConfig, viewer: WalletDepositViewer): number[] =>
  getTokenRows(token, viewer)
    .filter(({ state }) => isOfferedRhinoRow(state))
    .map(({ chainId }) => chainId);

/**
 * How the address screen serves a pairing: `own` (the Safe, or an address our
 * pipeline mints, on Base and Fuse), `rhino` (its rhino.fi address), `loading` or `unavailable`
 * (rhino.fi's routes are not in, or cannot be had), or `none` — not a row this
 * person is offered, which the screen moves off.
 */
export const getWalletDepositRow = (
  chainId: number,
  symbol: string,
  viewer: WalletDepositViewer = {},
): WalletDepositRow => {
  const token = findToken(symbol);
  const row = token && getTokenRows(token, viewer).find(item => item.chainId === chainId);
  return row?.state ?? { kind: 'none' };
};

/**
 * "More networks" for a currency: the chains the app has no row for that
 * rhino.fi takes it into the wallet from (Tron, Solana, Avalanche, …), in
 * rhino.fi's order. Only once its routes are in, and only for a currency this
 * person is offered at all (native BTC: the new deposit tokens). USDT
 * included: Tron, Solana and the rest pay it to the Safe as USDC (see
 * `getRhinoExtraChains`).
 */
export const getWalletDepositExtraNetworks = (
  symbol: string,
  viewer: WalletDepositViewer = {},
): RhinoDepositChain[] => {
  const token = findToken(symbol);
  if (!token || !isOffered(token, viewer) || viewer.rhino?.status !== 'ready') return [];
  return getRhinoExtraChains(viewer.rhino.assets, {
    destinationType: WALLET_RHINO_DESTINATION,
    symbol,
  });
};

/**
 * How the address screen serves a "More networks" chain (`rhinoChain`, e.g.
 * `TRON`) for a currency: its rhino.fi address while rhino.fi still takes the
 * currency into the wallet there, `loading` or `unavailable` while its routes
 * are not in, and `none` once it does not, or rhino.fi is off, which the
 * screen moves off.
 */
export const getWalletDepositExtraRow = (
  rhinoChain: string,
  symbol: string,
  viewer: WalletDepositViewer = {},
): WalletDepositRow => {
  const status = viewer.rhino?.status ?? 'loading';
  if (status === 'disabled') return { kind: 'none' };
  if (status !== 'ready') return { kind: status };
  const chain = getWalletDepositExtraNetworks(symbol, viewer).find(
    item => item.chain === rhinoChain,
  );
  return chain
    ? {
        kind: 'rhino',
        selection: getRhinoExtraSelection(chain, {
          destinationType: WALLET_RHINO_DESTINATION,
          symbol,
        }),
      }
    : { kind: 'none' };
};

/**
 * The "More networks" chain to show once `symbol` is picked: the one showing
 * (`currentRhinoChain`) when rhino.fi takes the currency into the wallet there
 * too, as an app chain carries over; else, for a currency no row of the list's
 * own carries (native BTC, which only Bitcoin takes), rhino.fi's first chain
 * for it. Undefined otherwise: the address goes to one of the list's rows (see
 * `resolveWalletDepositChain`).
 */
export const resolveWalletDepositExtraChain = (
  symbol: string,
  currentRhinoChain: string | undefined,
  viewer: WalletDepositViewer = {},
): string | undefined => {
  const extraChains = getWalletDepositExtraNetworks(symbol, viewer);
  if (currentRhinoChain && extraChains.some(chain => chain.chain === currentRhinoChain)) {
    return currentRhinoChain;
  }
  const token = findToken(symbol);
  return token && isMoreNetworksOnly(token) ? extraChains[0]?.chain : undefined;
};

/**
 * What the network list says about a currency's rows it cannot offer yet:
 * `loading` while rhino.fi's routes are out, `unavailable` when they could not
 * be had. Undefined once they are in, or for a currency only Fuse takes.
 */
export const getWalletDepositNetworksNotice = (
  symbol: string,
  viewer: WalletDepositViewer = {},
): 'loading' | 'unavailable' | undefined => {
  const token = findToken(symbol);
  const kinds = token ? getTokenRows(token, viewer).map(({ state }) => state.kind) : [];
  if (kinds.includes('loading')) return 'loading';
  return kinds.includes('unavailable') ? 'unavailable' : undefined;
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
 * Off Base and Fuse the address is the user's rhino.fi address for the row,
 * so the choice decides the address as well as which currencies are on offer,
 * what the minimum is, and which logo the QR carries.
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
 * `DEFAULT_WALLET_DEPOSIT_CHAIN_ID`), falling back if Base is off. Both are
 * offered to everyone, so this needs no viewer. On Base the address is the
 * Safe, a Wirex cardholder's included, whatever the state of rhino.fi.
 */
export const getDefaultWalletDepositSelection = (): { chainId: number; symbol: string } => {
  const networks = getWalletDepositNetworks();
  const chainId = networks.some(network => network.chainId === DEFAULT_WALLET_DEPOSIT_CHAIN_ID)
    ? DEFAULT_WALLET_DEPOSIT_CHAIN_ID
    : (networks[0]?.chainId ?? mainnet.id);

  return { chainId, symbol: 'USDC' };
};

/**
 * Every currency the deposit address can take, each once, for "Select token" —
 * the first step, taken before any chain is chosen. In the order the design
 * lists them: the stablecoins, gold and silver, then ETH and the rest, with the
 * wrapped natives last. A currency only "More networks" carries counts: native
 * BTC has no row of the list's own.
 */
export const getAllWalletDepositTokens = (viewer: WalletDepositViewer = {}): WalletDepositToken[] =>
  WALLET_DEPOSIT_TOKENS.filter(token =>
    isMoreNetworksOnly(token)
      ? getWalletDepositExtraNetworks(token.symbol, viewer).length > 0
      : getTokenChainIds(token, viewer).length > 0,
  ).map(toWalletDepositToken);

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
 * them when nothing is chosen yet; none for a currency no row takes (yet: until
 * rhino.fi's routes are in, only Base's and Fuse's rows are offered).
 */
export const getWalletDepositNetworksForToken = (
  symbol?: string,
  viewer: WalletDepositViewer = {},
): WalletDepositNetwork[] => {
  const networks = getWalletDepositNetworks(viewer);
  const token = findToken(symbol);
  if (!token) return networks;

  const carrying = getTokenChainIds(token, viewer);
  return networks.filter(network => carrying.includes(network.chainId));
};

/**
 * The chain the address opens on once `symbol` is picked.
 *
 * The current chain when it carries the currency, so changing only the currency
 * from the address screen keeps the chain. Otherwise the default chain (see
 * `getDefaultWalletDepositSelection`) if it carries it, else the first that does:
 * Ethereum for ETH, which only those given the new deposit tokens have on Base.
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
