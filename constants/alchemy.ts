import { arbitrum, base, mainnet, polygon } from 'viem/chains';

import { EXPO_PUBLIC_ALCHEMY_API_KEY } from '@/lib/config';

/**
 * Alchemy is the primary on-chain data provider for these chains;
 * Blockscout is used as fallback on Alchemy failure. Fuse (122) is not
 * supported by Alchemy and always uses Blockscout.
 */
export const ALCHEMY_SUPPORTED_CHAIN_IDS: ReadonlySet<number> = new Set([
  mainnet.id,
  base.id,
  polygon.id,
  arbitrum.id,
]);

export const ALCHEMY_CHAIN_URLS: Record<number, string> = {
  [mainnet.id]: `https://eth-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [base.id]: `https://base-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [polygon.id]: `https://polygon-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [arbitrum.id]: `https://arb-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
};

export const isAlchemyChain = (chainId: number): boolean =>
  ALCHEMY_SUPPORTED_CHAIN_IDS.has(chainId) && !!ALCHEMY_CHAIN_URLS[chainId];

export const ALCHEMY_REQUEST_TIMEOUT_MS = 10_000;
