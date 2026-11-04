import { base, fuse, mainnet } from 'viem/chains';

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
 * but Fuse's.
 *
 * - A network row the app lists (Ethereum, Base, Arbitrum, …) uses rhino.fi when
 *   rhino.fi has a route from that chain (matched by `chainId`) for the screen's
 *   destination, token and vault, the chain the route pays out on included. A
 *   row it has no route for is not offered: there is no address of our own to
 *   fall back to.
 * - Fuse rows are our own pipeline's (the direct-deposit session, or the Safe),
 *   whatever rhino.fi lists: rhino.fi does not support Fuse.
 * - Every other row waits for `/deposit/rhino/assets`, and is unavailable when
 *   that fails or says rhino.fi is off (see `resolveRhinoRow`).
 *
 * The menu is the app's own lists: a row only ever asks for a token its screen
 * already offers, so whatever else rhino.fi lists (USDe, PYUSD, …) never shows.
 *
 * A leaf module with no asset or React imports, so the rules are unit testable.
 * The backend decides every route; this only filters and words what
 * `/deposit/rhino/assets` returns.
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

/** One rhino.fi deposit address the user has asked to see. */
export type RhinoDepositSelection = {
  /** rhino.fi chain id, e.g. `MATIC_POS`. */
  chain: string;
  /**
   * The network row this address is for, an EVM chain the app lists itself. The
   * address screen keeps that row's name and logo ("Polygon", not rhino.fi's
   * "Polygon PoS"), so it reads as the row that was tapped.
   */
  chainId: number;
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

const KNOWN_ADDRESS_TYPES: ReadonlySet<string> = new Set<RhinoAddressType>(['EVM', 'TRON', 'SOL']);

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
  assets?: RhinoDepositAssetsResponse,
): assets is RhinoDepositAssetsResponse => assets?.enabled === true;

/**
 * Where a screen stands on `/deposit/rhino/assets`: still waiting for it,
 * `ready` with rhino.fi on, or `unavailable`, because the request failed or the
 * backend has rhino.fi off. Only `ready` carries the assets.
 */
export type RhinoAssetsState =
  | { status: 'loading' | 'unavailable'; assets?: undefined }
  | { status: 'ready'; assets: RhinoDepositAssetsResponse };

/**
 * The state of the assets query, from what react-query reports. An answer with
 * rhino.fi on is used even while a refresh is out, so a background refetch
 * never takes the rows away; anything else being asked again (the first time,
 * or a retry) is waiting, whatever came before.
 */
export const getRhinoAssetsState = (
  data: RhinoDepositAssetsResponse | undefined,
  { isFetching, isError }: { isFetching: boolean; isError: boolean },
): RhinoAssetsState => {
  if (isRhinoDepositOffered(data)) return { status: 'ready', assets: data };
  if (isFetching || (!data && !isError)) return { status: 'loading' };
  return { status: 'unavailable' };
};

const routeMatches = (route: RhinoDepositRoute, filter: RhinoRouteFilter): boolean =>
  route.destinationType === filter.destinationType &&
  (filter.vault === undefined || route.vault === filter.vault);

/** The tokens on a chain that have a route for this screen. */
export const getRhinoTokensForDestination = (
  chain: RhinoDepositChain,
  filter: RhinoRouteFilter,
): RhinoDepositToken[] =>
  chain.tokens.filter(
    token =>
      (filter.symbol === undefined || token.symbol === filter.symbol) &&
      token.routes.some(route => routeMatches(route, filter)),
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
  return assets.chains.filter(
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
  const route = token?.routes.find(item => routeMatches(item, filter));
  return chain && token && route ? { chain, token, route } : undefined;
};

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
 * (a Base deposit into the Safe on Base goes through rhino.fi too).
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
 * - `own`: Fuse, with our own pipeline's address, as it always was;
 * - `rhino`: the rhino.fi address for `selection`;
 * - `loading`: not known until the assets arrive, so not offered yet;
 * - `unavailable`: the assets failed, or rhino.fi is off, so it cannot be offered;
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
  if (isOwnPipelineChain(row.chainId)) return { kind: 'own' };
  if (state.status !== 'ready') return { kind: state.status };
  const selection = getRhinoSelectionForRow(state.assets, row);
  return selection ? { kind: 'rhino', selection } : { kind: 'none' };
};

/**
 * Whether a row has an address to show — ours on Fuse, rhino.fi's elsewhere —
 * and so can be picked.
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
 * Whether an address is well-formed for its chain. Only EVM addresses are 0x;
 * a Tron or Solana address that came back as one (or the reverse) would be an
 * address nothing on that chain can send to, so it is treated as a failure.
 */
export const isValidRhinoDepositAddress = (address: string, addressType: string): boolean => {
  switch (addressType) {
    case 'EVM':
      return EVM_ADDRESS.test(address);
    case 'TRON':
      return TRON_ADDRESS.test(address);
    case 'SOL':
      return SOLANA_ADDRESS.test(address);
    default:
      return false;
  }
};

/**
 * Whether two deposit addresses are the same. EVM addresses are hex, so case is
 * only a checksum; Tron and Solana are base58, where case is part of the value.
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
