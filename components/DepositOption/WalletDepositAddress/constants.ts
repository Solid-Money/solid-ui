import { ImageSourcePropType } from 'react-native';
import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import { getAsset } from '@/lib/assets';
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
  FUSE: 100,
  WFUSE: 100,
};

/** Used for a chain with no entry above, rather than claiming there is no floor. */
const DEFAULT_MINIMUM_DEPOSIT = 1;

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

export const getWalletDepositMinimum = (chainId: number, symbol: string): number =>
  MINIMUM_DEPOSIT_BY_TOKEN[symbol] ?? MINIMUM_DEPOSIT_BY_CHAIN[chainId] ?? DEFAULT_MINIMUM_DEPOSIT;

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
