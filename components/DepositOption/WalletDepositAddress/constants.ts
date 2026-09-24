import { ImageSourcePropType } from 'react-native';
import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import { getAsset } from '@/lib/assets';
import { CardProvider, DepositAsset } from '@/lib/types';
import { getAllowedTokensForChain, getVaultDepositConfig } from '@/lib/vaults';

export type WalletDepositNetwork = {
  chainId: number;
  name: string;
  icon: ImageSourcePropType;
};

export type WalletDepositToken = {
  symbol: string;
  icon: ImageSourcePropType;
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
const MINIMUM_DEPOSIT_BY_CHAIN: Record<number, number> = {
  [mainnet.id]: 10,
  [polygon.id]: 1,
  [base.id]: 1,
  [arbitrum.id]: 1,
  [bsc.id]: 1,
  [fuse.id]: 1,
};

/**
 * Overrides for the assets that are not worth ~$1 a unit, so every floor lands in
 * roughly the same place in dollars. Each of these exists on exactly one chain
 * (ETH/WETH on Ethereum, FUSE/WFUSE on Fuse), so the symbol alone identifies it.
 */
const MINIMUM_DEPOSIT_BY_TOKEN: Record<string, number> = {
  ETH: 0.005,
  WETH: 0.005,
  FUSE: 500,
  WFUSE: 500,
};

/** Used for a chain with no entry above, rather than claiming there is no floor. */
const DEFAULT_MINIMUM_DEPOSIT = 1;

/** The stablecoins the deposit pipeline has a route for. */
const DIRECT_DEPOSIT_SYMBOLS = new Set(['USDC', 'USDT']);

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
 * - A stablecoin. ETH, WETH, FUSE and WFUSE have no route through the pipeline;
 *   they land in the Safe and stay as the token that was sent, so there the Safe
 *   address is the right answer rather than a fallback.
 */
export const usesDirectDepositAddress = (
  symbol: string,
  provider: CardProvider | null | undefined,
): boolean => provider === CardProvider.WIREX && DIRECT_DEPOSIT_SYMBOLS.has(symbol);

/**
 * The order "Select token" leads with. The stablecoins people actually deposit
 * come first, then ETH; everything else follows in network order.
 */
const TOKEN_DISPLAY_ORDER = ['USDC', 'USDT', 'ETH'];

/**
 * The contract the pipeline credits for a native asset. It lists WETH and WFUSE;
 * the deposit screen offers ETH and FUSE, which are the same floor.
 */
const WRAPPED_EQUIVALENT: Record<string, string> = {
  ETH: 'WETH',
  FUSE: 'WFUSE',
};

/** Icons for tokens whose `BRIDGE_TOKENS` entry carries none (e.g. USDC off mainnet). */
const TOKEN_ICON_FALLBACKS: Record<string, ImageSourcePropType> = {
  USDC: getAsset('images/usdc-4x.png'),
  USDT: getAsset('images/usdt.png'),
  ETH: getAsset('images/eth.png'),
  WETH: getAsset('images/weth.png'),
  FUSE: getAsset('images/fuse-4x.png'),
  WFUSE: getAsset('images/wfuse.png'),
};

export const getWalletDepositTokenIcon = (chainId: number, symbol: string): ImageSourcePropType => {
  const icon = BRIDGE_TOKENS[chainId]?.tokens?.[symbol]?.icon;
  return icon ?? TOKEN_ICON_FALLBACKS[symbol] ?? TOKEN_ICON_FALLBACKS.USDC;
};

/** The currencies that chain accepts, in the order `BRIDGE_TOKENS` lists them. */
export const getWalletDepositTokens = (chainId: number): WalletDepositToken[] =>
  getAllowedTokensForChain(chainId).map(symbol => ({
    symbol,
    icon: getWalletDepositTokenIcon(chainId, symbol),
  }));

/**
 * Chains the wallet can be funded on, in display order.
 *
 * The deposit address is the user's Safe, which is the same address on every
 * chain — the choice here only decides which currencies are on offer, what the
 * minimum is, and which logo the QR carries.
 */
export const getWalletDepositNetworks = (): WalletDepositNetwork[] => {
  const { supportedChains } = getVaultDepositConfig();

  return Object.entries(BRIDGE_TOKENS)
    .map(([id, chain]) => ({ chainId: Number(id), chain }))
    .filter(({ chainId, chain }) => supportedChains.includes(chainId) && !chain.isComingSoon)
    .filter(({ chainId }) => getWalletDepositTokens(chainId).length > 0)
    .sort((a, b) => a.chain.sort - b.chain.sort)
    .map(({ chainId, chain }) => ({ chainId, name: chain.name, icon: chain.icon }));
};

/**
 * The currency to show once `chainId` is chosen.
 *
 * A currency carries over between chains when the new one accepts it, so picking
 * a chain does not silently reset a deliberate choice. When it does not — USDT
 * is not offered on Base, ETH only exists on Ethereum — it falls back to what
 * the chain does carry, rather than leaving the screen quoting a minimum for a
 * pairing that does not exist.
 */
export const resolveWalletDepositSymbol = (
  chainId: number,
  symbol?: string,
): string | undefined => {
  const tokens = getWalletDepositTokens(chainId);
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
 * the floor is the same either way.
 */
export const resolveWalletDepositMinimum = (
  chainId: number,
  symbol: string,
  assets?: DepositAsset[],
): number => {
  const wanted = WRAPPED_EQUIVALENT[symbol] ?? symbol;
  const published = assets?.find(asset => asset.chainId === chainId && asset.symbol === wanted);
  const parsed = published ? Number(published.minimum) : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : getWalletDepositMinimum(chainId, symbol);
};

/**
 * The pairing the screen opens on: USDC on Fuse, falling back if either is off.
 *
 * Fuse rather than Ethereum because this address is the user's Safe on the
 * chain they pick, not a bridge — what lands on Ethereum stays on Ethereum.
 * Everything the app then spends that balance on lives on Fuse: the card, the
 * vaults, and the annual membership charge, which can only ever move Fuse
 * USDC.e. Opening on Ethereum put the most expensive gas and the one chain the
 * balance cannot be used from in front of the user by default.
 */
export const getDefaultWalletDepositSelection = (): { chainId: number; symbol: string } => {
  const networks = getWalletDepositNetworks();
  const chainId = networks.some(network => network.chainId === fuse.id)
    ? fuse.id
    : (networks[0]?.chainId ?? mainnet.id);
  const tokens = getWalletDepositTokens(chainId);
  const symbol =
    tokens.find(token => token.symbol === 'USDC')?.symbol ?? tokens[0]?.symbol ?? 'USDC';

  return { chainId, symbol };
};

/**
 * Every currency the deposit address can take, each once, for "Select token" —
 * the first step, taken before any chain is chosen.
 *
 * `TOKEN_DISPLAY_ORDER` leads, because a list derived from chain order put FUSE
 * and WFUSE above USDT and ETH purely because Fuse is the default chain, which
 * is not the order anyone looks for them in. Whatever is not named there follows
 * in network order. Each is drawn with the icon of the first chain carrying it.
 */
export const getAllWalletDepositTokens = (): WalletDepositToken[] => {
  const { chainId: defaultChainId } = getDefaultWalletDepositSelection();
  const chainIds = [
    defaultChainId,
    ...getWalletDepositNetworks()
      .map(network => network.chainId)
      .filter(chainId => chainId !== defaultChainId),
  ];
  const seen = new Set<string>();
  const tokens = chainIds.flatMap(chainId =>
    getWalletDepositTokens(chainId).filter(token => {
      if (seen.has(token.symbol)) return false;
      seen.add(token.symbol);
      return true;
    }),
  );

  const rank = (symbol: string) => {
    const index = TOKEN_DISPLAY_ORDER.indexOf(symbol);
    return index === -1 ? TOKEN_DISPLAY_ORDER.length : index;
  };

  return [...tokens].sort((a, b) => rank(a.symbol) - rank(b.symbol));
};

/**
 * The chains "Select chain" offers once a currency is chosen: only those that
 * carry it, so switching chain can never quietly switch the currency too. All of
 * them when nothing is chosen yet, or no chain carries it.
 */
export const getWalletDepositNetworksForToken = (symbol?: string): WalletDepositNetwork[] => {
  const networks = getWalletDepositNetworks();
  const carrying = networks.filter(network =>
    getWalletDepositTokens(network.chainId).some(token => token.symbol === symbol),
  );

  return carrying.length ? carrying : networks;
};

/**
 * The chain the address opens on once `symbol` is picked.
 *
 * The current chain when it carries the currency, so changing only the currency
 * from the address screen keeps the chain. Otherwise the default chain (see
 * `getDefaultWalletDepositSelection`) if it carries it, else the first that does.
 */
export const resolveWalletDepositChain = (symbol: string, currentChainId?: number): number => {
  const carrying = getWalletDepositNetworksForToken(symbol).map(network => network.chainId);
  if (currentChainId !== undefined && carrying.includes(currentChainId)) return currentChainId;

  const { chainId: defaultChainId } = getDefaultWalletDepositSelection();
  return carrying.includes(defaultChainId) ? defaultChainId : (carrying[0] ?? defaultChainId);
};
