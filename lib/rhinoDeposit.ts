import { arbitrum, base, bsc, fuse, mainnet, optimism, polygon } from 'viem/chains';

import type {
  RhinoAddressType,
  RhinoDeposit,
  RhinoDepositAssetsResponse,
  RhinoDepositChain,
  RhinoDepositRoute,
  RhinoDepositStatus,
  RhinoDepositToken,
  RhinoDestinationType,
} from '@/lib/types';

/**
 * rhino.fi Smart Deposit Addresses: the deposit provider on every network row
 * but Fuse's, and for every token but the few our own pipeline still carries.
 *
 * - A network row the app lists (Ethereum, Polygon, Arbitrum, …) uses rhino.fi
 *   when rhino.fi has a route from that chain (matched by `chainId`) for the
 *   screen's destination, token and vault. A row it has no route for is not
 *   offered: there is no address of our own to fall back to.
 * - Except on the chain the route pays out on, for the token it pays out: the
 *   deposit is already where it is going, so our own address takes it, free
 *   (the wallet and card on Base, savings on the vault's chain; see
 *   `isOwnPayoutChain` and `resolveRhinoRow`).
 * - Fuse rows are our own pipeline's (the direct-deposit session, or the Safe),
 *   whatever rhino.fi lists: rhino.fi does not support Fuse.
 * - So are the wallet and card rows of a token on a chain in
 *   `OWN_PIPELINE_TOKEN_CHAINS` (USDT on Base), which rhino.fi is not trusted to
 *   accept there.
 * - Every other row waits for `/deposit/rhino/assets`, and is unavailable when
 *   that fails (see `resolveRhinoRow`).
 * - When the backend has rhino.fi off (`enabled: false`, as it answers without
 *   an API key, or a backend that predates the endpoint), every row is our own
 *   pipeline's again, as before rhino.fi: there is nothing to retry, and our
 *   own addresses are what the backend is serving (see `RhinoAssetsState`).
 * - Under a screen's own rows, "More networks": the chains rhino.fi serves that
 *   the app has no row for (Tron, Solana, Avalanche, …), for the screen's token
 *   and destination only (see `getRhinoExtraChains`).
 *
 * The menu is the app's own lists: a row only ever asks for a token its screen
 * already offers, so whatever else rhino.fi lists (USDe, PYUSD, …) never shows.
 *
 * A leaf module with no asset or React imports, so the rules are unit testable.
 * The backend decides every route; this only filters and words what
 * `/deposit/rhino/assets` returns, and treats a list missing from it as empty.
 */

/** The chip on a row rhino.fi serves, setting it apart from the Fuse rows we watch ourselves. */
export const RHINO_NETWORK_CHIP = 'via rhino.fi';

/** Chains our own pipeline keeps, whatever rhino.fi offers there. */
const OWN_PIPELINE_CHAIN_IDS: ReadonlySet<number> = new Set([fuse.id]);

/**
 * Whether a row is our own pipeline's rather than rhino.fi's: Fuse, which
 * rhino.fi does not support, and which keeps the direct-deposit session or the
 * Safe it always had.
 */
export const isOwnPipelineChain = (chainId: number): boolean => OWN_PIPELINE_CHAIN_IDS.has(chainId);

/**
 * The tokens our own pipeline still takes on the wallet and card screens, and
 * the chains it takes them on, rather than rhino.fi: USDT sent on Base.
 *
 * rhino.fi takes wallet and card USDT from every other chain and pays it out as
 * USDC on Base, since it cannot pay USDT out there for us (the backend's
 * `WALLET_USDT` and `CARD_USDC` routes; the address screen says "Converted to
 * USDC"). Sent on Base itself, its docs have Base USDT as "Delivery only", so
 * it is not trusted to accept it, and the backend lists no wallet or card USDT
 * route there. The wallet's Base row is the Safe, which spends USDT as it is;
 * the card's is the card deposit address. Savings is not affected: rhino.fi's
 * soUSD route takes USDT on every chain it lists, as USDC.
 */
export const OWN_PIPELINE_TOKEN_CHAINS: Readonly<Record<string, ReadonlySet<number>>> = {
  USDT: new Set([base.id]),
};

/**
 * Where the wallet and card routes pay out: Base, every token. A wallet or
 * card deposit sent on Base is already where it is going, so our own address
 * takes it there, free, rather than rhino.fi, which would charge its minimum,
 * run its checks and pay it back to the same chain. Known without rhino.fi's
 * routes, so those rows never wait for them. Savings' chain depends on the
 * vault (and soUSD's on the deployment), so it is read from the route instead
 * (see `resolveRhinoRow`).
 */
const PAYOUT_CHAIN_BY_DESTINATION: Readonly<Partial<Record<RhinoDestinationType, number>>> = {
  WALLET: base.id,
  RAIN_CARD: base.id,
};

/** Whether a wallet or card row is on the chain its route pays out on (Base). */
export const isOwnPayoutChain = (destinationType: RhinoDestinationType, chainId: number): boolean =>
  PAYOUT_CHAIN_BY_DESTINATION[destinationType] === chainId;

/** The destinations `OWN_PIPELINE_TOKEN_CHAINS` applies to: the wallet's and the card's. */
const OWN_PIPELINE_DESTINATIONS: ReadonlySet<RhinoDestinationType> = new Set<RhinoDestinationType>([
  'WALLET',
  'RAIN_CARD',
]);

/**
 * Whether a token sent on a chain goes through our own pipeline for this
 * destination, rhino.fi's routes aside: USDT on Base to the wallet or the card
 * (see `OWN_PIPELINE_TOKEN_CHAINS`). Never a "More networks" chain: Base is
 * one of the app's own rows.
 */
export const isOwnPipelineToken = (
  symbol: string,
  destinationType: RhinoDestinationType,
  chainId: number,
): boolean =>
  OWN_PIPELINE_DESTINATIONS.has(destinationType) &&
  (OWN_PIPELINE_TOKEN_CHAINS[symbol]?.has(chainId) ?? false);

/**
 * A list from `/deposit/rhino/assets`, or none when the payload left it out
 * (or sent `null`): a malformed answer offers nothing rather than throwing in
 * the middle of a render.
 */
const listOf = <T>(items: readonly T[] | null | undefined): readonly T[] =>
  Array.isArray(items) ? items : [];

/** One rhino.fi deposit address the user has asked to see. */
export type RhinoDepositSelection = {
  /** rhino.fi chain id, e.g. `MATIC_POS`. */
  chain: string;
  /**
   * The network row this address is for, an EVM chain the app lists itself. The
   * address screen keeps that row's name and logo ("Polygon", not rhino.fi's
   * "Polygon PoS"), so it reads as the row that was tapped. For a "More
   * networks" chain, rhino.fi's own EVM id when it has one (Avalanche), and
   * nothing for Tron or Solana: the screen then uses rhino.fi's name.
   */
  chainId?: number;
  tokenSymbol: string;
  destinationType: RhinoDestinationType;
  /** The savings vault the screen promises, for `PROTOCOL`. */
  vault?: string;
};

/** Which routes a screen can use: its destination, and optionally its token and vault. */
export type RhinoRouteFilter = {
  destinationType: RhinoDestinationType;
  /** The token already chosen on an earlier step. Omit to accept any. */
  symbol?: string;
  /**
   * The savings vault the flow is funding. A `PROTOCOL` route into another
   * vault is left out, so the screen never promises soUSD and delivers soETH.
   */
  vault?: string;
};

const KNOWN_ADDRESS_TYPES: ReadonlySet<string> = new Set<RhinoAddressType>([
  'EVM',
  'TRON',
  'SOL',
  'BTC',
]);

/**
 * Whether the app knows how to show an address of this type. A chain whose
 * addresses it cannot validate is not offered, rather than shown unchecked.
 */
export const isKnownRhinoAddressType = (addressType: string): addressType is RhinoAddressType =>
  KNOWN_ADDRESS_TYPES.has(addressType);

/**
 * Whether the backend has rhino.fi on. Not gated on any rollout: rhino.fi is the
 * provider for everyone the moment it answers `enabled: true`.
 */
export const isRhinoDepositOffered = (
  assets?: RhinoDepositAssetsResponse | null,
): assets is RhinoDepositAssetsResponse =>
  typeof assets === 'object' && assets !== null && assets.enabled === true;

/**
 * Where a screen stands on `/deposit/rhino/assets`:
 *
 * - `loading`: still waiting for it;
 * - `ready`: rhino.fi is on, with its routes. Only this state carries them;
 * - `unavailable`: the request failed, so which rows rhino.fi serves is not
 *   known. The screens offer a retry;
 * - `disabled`: the backend has rhino.fi off, so every row is our own
 *   pipeline's, as it was before rhino.fi. Nothing to retry: asking again gets
 *   the same answer until the backend is configured.
 */
export type RhinoAssetsState =
  | { status: 'loading' | 'unavailable' | 'disabled'; assets?: undefined }
  | { status: 'ready'; assets: RhinoDepositAssetsResponse };

/**
 * Whether the backend says rhino.fi is off: it answered `enabled: false` (no
 * API key configured), or it has no such endpoint at all (404, a backend that
 * predates rhino.fi). Either way it is serving our own addresses alone.
 */
const isRhinoDepositOff = (data: RhinoDepositAssetsResponse | undefined, error: unknown): boolean =>
  (typeof data === 'object' && data !== null && data.enabled === false) ||
  (error as { status?: number } | null | undefined)?.status === 404;

/**
 * The state of the assets query, from what react-query reports. An answer
 * either way is kept while a refresh is out, so a background refetch never
 * takes the rows away; anything else being asked again (the first time, or a
 * retry) is waiting, whatever came before.
 */
export const getRhinoAssetsState = (
  data: RhinoDepositAssetsResponse | undefined,
  { isFetching, isError, error }: { isFetching: boolean; isError: boolean; error?: unknown },
): RhinoAssetsState => {
  if (isRhinoDepositOffered(data)) return { status: 'ready', assets: data };
  if (isRhinoDepositOff(data, isError ? error : undefined)) return { status: 'disabled' };
  if (isFetching || (!data && !isError)) return { status: 'loading' };
  return { status: 'unavailable' };
};

/**
 * What a screen shows in place of rhino.fi's rows for a state of its routes: a
 * loader while they are out, a retry when they cannot be had, and nothing once
 * they are in or rhino.fi is off (every row is then ours, and shows itself).
 */
export const getRhinoAssetsNotice = (
  status: RhinoAssetsState['status'],
): Extract<RhinoListNotice, 'loading' | 'unavailable'> | undefined =>
  status === 'loading' || status === 'unavailable' ? status : undefined;

const routeMatches = (route: RhinoDepositRoute, filter: RhinoRouteFilter): boolean =>
  route.destinationType === filter.destinationType &&
  (filter.vault === undefined || route.vault === filter.vault);

/** The tokens on a chain that have a route for this screen. */
export const getRhinoTokensForDestination = (
  chain: RhinoDepositChain,
  filter: RhinoRouteFilter,
): RhinoDepositToken[] =>
  listOf(chain.tokens).filter(
    token =>
      (filter.symbol === undefined || token.symbol === filter.symbol) &&
      listOf(token.routes).some(route => routeMatches(route, filter)),
  );

/**
 * The rhino.fi chains with at least one token paying out to this destination
 * (the chosen token, when there is one), less those our own pipeline keeps
 * (Fuse). Empty when rhino.fi is off.
 */
export const getRhinoChainsForDestination = (
  assets: RhinoDepositAssetsResponse | undefined,
  filter: RhinoRouteFilter,
): RhinoDepositChain[] => {
  if (!isRhinoDepositOffered(assets)) return [];
  return listOf(assets.chains).filter(
    chain =>
      isKnownRhinoAddressType(chain.addressType) &&
      (chain.chainId === undefined || !isOwnPipelineChain(chain.chainId)) &&
      getRhinoTokensForDestination(chain, filter).length > 0,
  );
};

/** The chain, token and route a selection resolves to, if it is still offered. */
export const findRhinoRoute = (
  assets: RhinoDepositAssetsResponse | undefined,
  selection: Omit<RhinoDepositSelection, 'chainId'>,
): { chain: RhinoDepositChain; token: RhinoDepositToken; route: RhinoDepositRoute } | undefined => {
  const filter: RhinoRouteFilter = {
    destinationType: selection.destinationType,
    symbol: selection.tokenSymbol,
    vault: selection.vault,
  };
  const chain = getRhinoChainsForDestination(assets, filter).find(
    item => item.chain === selection.chain,
  );
  const token = chain && getRhinoTokensForDestination(chain, filter)[0];
  const route = token && listOf(token.routes).find(item => routeMatches(item, filter));
  return chain && token && route ? { chain, token, route } : undefined;
};

/**
 * The EVM chains the app lists as network rows of its own, on one screen or
 * another. rhino.fi serves them behind those rows (see `resolveRhinoRow`), or
 * not at all, and never under "More networks": a chain shows once, as its row.
 */
const APP_NETWORK_CHAIN_IDS: ReadonlySet<number> = new Set([
  mainnet.id,
  polygon.id,
  base.id,
  arbitrum.id,
  optimism.id,
  bsc.id,
  fuse.id,
]);

/** rhino.fi chains kept out of "More networks" until the product decides on them: Arc. */
const HELD_BACK_RHINO_CHAINS: ReadonlySet<string> = new Set(['ARC']);

/**
 * Whether a rhino.fi chain is one the app has no row for, and so belongs under
 * "More networks": Tron, Solana, Avalanche, Celo, Gnosis, Mantle, Plasma, Kaia,
 * Tempo, whichever the backend lists. Never an app chain, and never one held
 * back (Arc).
 */
export const isRhinoExtraChain = (chain: Pick<RhinoDepositChain, 'chain' | 'chainId'>): boolean =>
  !HELD_BACK_RHINO_CHAINS.has(chain.chain) &&
  (chain.chainId === undefined || !APP_NETWORK_CHAIN_IDS.has(chain.chainId));

/** "More networks" always serves one token, the one the screen has already chosen. */
export type RhinoExtraChainFilter = RhinoRouteFilter & { symbol: string };

/**
 * "More networks": the rhino.fi chains the app has no row for, with a route for
 * the screen's token, destination and vault. Only what rhino.fi lists for that
 * destination, so a token it does not route there gets none. Wallet and card
 * USDT included: our own pipeline keeps it on Base alone, which is never one of
 * these. Empty when rhino.fi is off.
 */
export const getRhinoExtraChains = (
  assets: RhinoDepositAssetsResponse | undefined,
  filter: RhinoExtraChainFilter,
): RhinoDepositChain[] => getRhinoChainsForDestination(assets, filter).filter(isRhinoExtraChain);

/** The address a "More networks" chain shows for the screen's token. */
export const getRhinoExtraSelection = (
  chain: RhinoDepositChain,
  filter: RhinoExtraChainFilter,
): RhinoDepositSelection => ({
  chain: chain.chain,
  ...(chain.chainId !== undefined ? { chainId: chain.chainId } : {}),
  tokenSymbol: filter.symbol,
  destinationType: filter.destinationType,
  ...(filter.vault !== undefined ? { vault: filter.vault } : {}),
});

/** An existing network row, as the rhino.fi matching needs it. */
export type RhinoRowFilter = {
  /** The row's EVM chain id. */
  chainId: number;
  destinationType: RhinoDestinationType;
  symbol: string;
  vault?: string;
};

/**
 * The rhino.fi route a network row uses, matched on `chainId`: undefined when
 * rhino.fi has no route from that chain for the destination, token and vault,
 * and always for Fuse. The chain a route pays out on is matched like any other
 * here; `resolveRhinoRow` then gives that row to our own address.
 */
export const findRhinoRouteForRow = (
  assets: RhinoDepositAssetsResponse | undefined,
  row: RhinoRowFilter,
): { chain: RhinoDepositChain; token: RhinoDepositToken; route: RhinoDepositRoute } | undefined => {
  const chain = getRhinoChainsForDestination(assets, {
    destinationType: row.destinationType,
    symbol: row.symbol,
    vault: row.vault,
  }).find(item => item.chainId === row.chainId);

  return chain
    ? findRhinoRoute(assets, {
        chain: chain.chain,
        tokenSymbol: row.symbol,
        destinationType: row.destinationType,
        vault: row.vault,
      })
    : undefined;
};

/** The rhino.fi address a row shows, or undefined where rhino.fi has no route for it. */
export const getRhinoSelectionForRow = (
  assets: RhinoDepositAssetsResponse | undefined,
  row: RhinoRowFilter,
): RhinoDepositSelection | undefined => {
  const found = findRhinoRouteForRow(assets, row);
  return found
    ? {
        chain: found.chain.chain,
        chainId: row.chainId,
        tokenSymbol: row.symbol,
        destinationType: row.destinationType,
        ...(row.vault !== undefined ? { vault: row.vault } : {}),
      }
    : undefined;
};

/**
 * How one of a screen's own network rows is served:
 *
 * - `own`: our own pipeline's address (a direct-deposit session, or the Safe):
 *   on Fuse, as it always was; for a token our pipeline still takes on that
 *   chain for that destination (`isOwnPipelineToken`: USDT on Base to the
 *   wallet or the card); on the chain a route pays out on, for the token it
 *   pays out (Base for the wallet and card, `isOwnPayoutChain`; the vault's
 *   chain for savings), whatever rhino.fi lists; and on every row while the
 *   backend has rhino.fi off. The screen
 *   decides the address: the card's `RAIN_CARD` session, savings' `PROTOCOL`
 *   one, or for the wallet `getWalletOwnAddress`'s;
 * - `rhino`: the rhino.fi address for `selection`;
 * - `loading`: not known until the assets arrive, so not offered yet;
 * - `unavailable`: the assets failed, so it cannot be offered;
 * - `none`: rhino.fi has no route for it, so the row is not shown.
 *
 * Only `own` and `rhino` rows have an address; nothing else may be picked, and
 * nothing else ever mints a direct-deposit session.
 */
export type RhinoRowState =
  | { kind: 'own' }
  | { kind: 'rhino'; selection: RhinoDepositSelection }
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'none' };

/** How a screen's own network row is served, from the state of rhino.fi's routes. */
export const resolveRhinoRow = (state: RhinoAssetsState, row: RhinoRowFilter): RhinoRowState => {
  if (
    isOwnPipelineChain(row.chainId) ||
    isOwnPipelineToken(row.symbol, row.destinationType, row.chainId) ||
    isOwnPayoutChain(row.destinationType, row.chainId) ||
    // rhino.fi is off: our own pipeline serves every row, as before rhino.fi.
    state.status === 'disabled'
  ) {
    return { kind: 'own' };
  }
  if (state.status !== 'ready') return { kind: state.status };
  const found = findRhinoRouteForRow(state.assets, row);
  // Sent on the chain the route pays out on, as the token it would pay out: the
  // deposit is already where it is going, and our own address takes it there
  // for free (soETH on Ethereum, soUSD and soEURC on theirs).
  if (
    found &&
    found.route.receiveChainId === row.chainId &&
    found.route.receiveSymbol === row.symbol
  ) {
    return { kind: 'own' };
  }
  const selection = getRhinoSelectionForRow(state.assets, row);
  return selection ? { kind: 'rhino', selection } : { kind: 'none' };
};

/**
 * Whether a row has an address to show — ours on Fuse and for USDT on Base to
 * the wallet or card, rhino.fi's elsewhere — and so can be picked.
 */
export const isOfferedRhinoRow = (
  state: RhinoRowState,
): state is Extract<RhinoRowState, { kind: 'own' | 'rhino' }> =>
  state.kind === 'own' || state.kind === 'rhino';

/** What a network list shows in place of the rows it cannot offer. */
export type RhinoListNotice = 'loading' | 'unavailable' | 'empty';

/**
 * A loader while any row waits for the assets, a retry when any is unavailable,
 * and an empty state when the answer is in and no row has an address. One
 * notice for the list rather than one per row: which rows there will be is
 * exactly what is not known yet. Undefined when the rows say it all.
 */
export const getRhinoListNotice = (
  states: readonly RhinoRowState[],
): RhinoListNotice | undefined => {
  if (states.some(state => state.kind === 'loading')) return 'loading';
  if (states.some(state => state.kind === 'unavailable')) return 'unavailable';
  return states.some(isOfferedRhinoRow) ? undefined : 'empty';
};

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
/** Base58check, 34 characters, always starting with T. */
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
/** A base58 public key: 32 bytes, so 32 to 44 characters. */
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/**
 * Mainnet Bitcoin, in either encoding: bech32/bech32m, `bc1` and lowercase
 * (SegWit, and Taproot's `bc1p`, which rhino.fi hands out), from bech32's
 * alphabet, which has no 1, b, i or o; or base58, `1` (legacy) or `3` (P2SH).
 */
const BITCOIN_BECH32_ADDRESS = /^bc1[02-9ac-hj-np-z]{11,71}$/;
const BITCOIN_BASE58_ADDRESS = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;

/**
 * Whether an address is well-formed for its chain. Only EVM addresses are 0x;
 * a Tron, Solana or Bitcoin address that came back as one (or the reverse)
 * would be an address nothing on that chain can send to, so it is treated as a
 * failure.
 */
export const isValidRhinoDepositAddress = (address: string, addressType: string): boolean => {
  switch (addressType) {
    case 'EVM':
      return EVM_ADDRESS.test(address);
    case 'TRON':
      return TRON_ADDRESS.test(address);
    case 'SOL':
      return SOLANA_ADDRESS.test(address);
    case 'BTC':
      return BITCOIN_BECH32_ADDRESS.test(address) || BITCOIN_BASE58_ADDRESS.test(address);
    default:
      return false;
  }
};

/**
 * Whether two deposit addresses are the same. EVM addresses are hex, so case is
 * only a checksum; Tron, Solana and Bitcoin's base58 are case-sensitive, and
 * bech32 is lowercase as handed out.
 */
export const isSameDepositAddress = (a: string, b: string, addressType: string): boolean =>
  addressType === 'EVM' ? a.toLowerCase() === b.toLowerCase() : a === b;

/**
 * An address shortened for display, keeping its own prefix: `0x12345...abcde`,
 * `TQn9Y2k...Lb8Hg`, `7xKXtg2...9sAsU`. Nothing assumes a 0x or a length of 42;
 * an address too short to be worth shortening is shown whole.
 */
export const formatDepositAddress = (address: string, start = 7, end = 5): string =>
  address.length <= start + end + 3
    ? address
    : `${address.slice(0, start)}...${address.slice(-end)}`;

const formatUsd = (value: number): string => {
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(2);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${fraction ? `${grouped}.${fraction}` : grouped}`;
};

/**
 * The band a deposit must fall in, in dollars: "Min $5 · Max $100,000". A
 * missing or non-positive bound is left out rather than printed as $0.
 */
export const formatRhinoUsdLimits = (minimumUsd?: number, maximumUsd?: number): string => {
  const parts: string[] = [];
  if (minimumUsd !== undefined && Number.isFinite(minimumUsd) && minimumUsd > 0) {
    parts.push(`Min ${formatUsd(minimumUsd)}`);
  }
  if (maximumUsd !== undefined && Number.isFinite(maximumUsd) && maximumUsd > 0) {
    parts.push(`Max ${formatUsd(maximumUsd)}`);
  }
  return parts.join(' · ');
};

/**
 * What a sender should know about a chain before sending on it: Bitcoin
 * settles far slower than the rest, so the usual few minutes would mislead.
 */
const RHINO_CHAIN_NOTES: Record<string, string> = {
  BITCOIN: 'Arrives after 1 Bitcoin confirmation, usually 5–20 min',
};

/** The note for a rhino.fi chain (`BITCOIN`), if it has one. */
export const getRhinoChainNote = (chain?: string): string | undefined =>
  chain ? RHINO_CHAIN_NOTES[chain] : undefined;

const RECEIVE_CHAIN_NAMES: Record<number, string> = {
  [mainnet.id]: 'Ethereum',
  [base.id]: 'Base',
};

/**
 * What lands, and where: "Arrives as USDC in your savings (soUSD)",
 * "Converted to USDC for your card", "Arrives as ETH in your wallet on Base".
 */
export const describeRhinoArrival = ({
  tokenSymbol,
  receiveSymbol,
  receiveChainId,
  destinationType,
  vault,
}: {
  tokenSymbol: string;
  receiveSymbol: string;
  receiveChainId?: number;
  destinationType: RhinoDestinationType;
  vault?: string;
}): string => {
  const isConverted = tokenSymbol !== receiveSymbol;
  const chainName = receiveChainId ? RECEIVE_CHAIN_NAMES[receiveChainId] : undefined;

  switch (destinationType) {
    case 'RAIN_CARD':
      return isConverted
        ? `Converted to ${receiveSymbol} for your card`
        : `Arrives as ${receiveSymbol} on your card`;
    case 'PROTOCOL': {
      const lead = isConverted ? `Converted to ${receiveSymbol}` : `Arrives as ${receiveSymbol}`;
      return `${lead} in your savings${vault ? ` (${vault})` : ''}`;
    }
    case 'WALLET':
    default: {
      const lead = isConverted ? `Converted to ${receiveSymbol}` : `Arrives as ${receiveSymbol}`;
      return `${lead} in your wallet${chainName ? ` on ${chainName}` : ''}`;
    }
  }
};

const REJECT_REASON_COPY: Record<string, string> = {
  UNDER_MIN: 'It was below the minimum for this network. Contact support for help.',
  OVER_MAX: 'It was above the maximum for this network. Contact support for help.',
  UNSUPPORTED_TOKEN: 'That token isn’t accepted on this address. Contact support for help.',
};

const GENERIC_REJECT_COPY = 'rhino.fi couldn’t process this deposit, contact support.';

/**
 * Why a deposit was rejected, in plain words. Only the reasons a sender can act
 * on are spelled out; every other `rejectReason` (OPERATION_UNAVAILABLE,
 * NO_ROUTE_FOUND, SDA_PAUSED, …) is a fault on the bridge's side, where the
 * only useful step is support.
 */
export const getRhinoRejectMessage = (rejectReason?: string): string =>
  (rejectReason && REJECT_REASON_COPY[rejectReason]) || GENERIC_REJECT_COPY;

/** Statuses after which nothing more will happen on rhino.fi's side. */
const TERMINAL_STATUSES: ReadonlySet<RhinoDepositStatus> = new Set<RhinoDepositStatus>([
  'EXECUTED',
  'REJECTED',
  'REFUNDED',
]);

export const isTerminalRhinoStatus = (status: RhinoDepositStatus): boolean =>
  TERMINAL_STATUSES.has(status);

export type RhinoDepositStatusView = {
  tone: 'progress' | 'success' | 'error' | 'neutral';
  title: string;
  body?: string;
};

/**
 * How a deposit seen by rhino.fi is shown on the address screen. It covers only
 * rhino.fi's leg: once the payout is executed, the regular deposit pipeline and
 * the activity feed take over.
 */
export const getRhinoDepositStatusView = (
  deposit: Pick<RhinoDeposit, 'status' | 'rejectReason'>,
  chainName: string,
): RhinoDepositStatusView => {
  switch (deposit.status) {
    case 'DELAYED':
      return {
        tone: 'progress',
        title: `Received on ${chainName} — on its way`,
        body: 'This is taking longer than usual.',
      };
    case 'EXECUTED':
      return {
        tone: 'success',
        title: `Received on ${chainName} — on its way`,
        body: 'It will show in your activity shortly.',
      };
    case 'REJECTED':
      return {
        tone: 'error',
        title: 'Deposit couldn’t be processed',
        body: getRhinoRejectMessage(deposit.rejectReason),
      };
    case 'REFUNDED':
      return {
        tone: 'neutral',
        title: 'Returned to the sender',
        body: 'rhino.fi sent this deposit back to the address it came from.',
      };
    case 'DETECTED':
    case 'ACCEPTED':
    default:
      return { tone: 'progress', title: `Received on ${chainName} — on its way` };
  }
};

/**
 * The deposit to show for an address: the newest one sent to it on that chain.
 * The endpoint returns every rhino.fi deposit the user made since the screen
 * opened, which can include other chains and destinations.
 */
export const pickRhinoDeposit = (
  deposits: RhinoDeposit[] | undefined,
  {
    depositAddress,
    chain,
    addressType,
  }: { depositAddress: string; chain: string; addressType: string },
): RhinoDeposit | undefined =>
  (deposits ?? [])
    .filter(
      deposit =>
        deposit.chain === chain &&
        isSameDepositAddress(deposit.depositAddress, depositAddress, addressType),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

/**
 * The toast body for a failed address request, by the status the backend
 * answered with. Undefined leaves the shared error copy to decide.
 */
export const getRhinoAddressErrorBody = (error: unknown): string | undefined => {
  const status = (error as { status?: number } | null)?.status;
  switch (status) {
    case 400:
      return 'This token can’t be sent on this network. Pick another network.';
    case 412:
      return 'Finish setting up your wallet, then try again.';
    case 503:
      return 'This network isn’t available right now. Try again later.';
    default:
      return undefined;
  }
};
