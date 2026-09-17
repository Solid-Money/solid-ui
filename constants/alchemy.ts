import { arbitrum, base, bsc, mainnet, polygon } from 'viem/chains';

import { EXPO_PUBLIC_ALCHEMY_API_KEY } from '@/lib/config';

/**
 * Alchemy is the primary on-chain data provider for these chains;
 * Blockscout is used as fallback on Alchemy failure. Fuse (122) is not
 * supported by Alchemy and always uses Blockscout. BSC (56) is Alchemy-only
 * (Blockscout has no BSC instance).
 */
export const ALCHEMY_SUPPORTED_CHAIN_IDS: ReadonlySet<number> = new Set([
  mainnet.id,
  base.id,
  polygon.id,
  arbitrum.id,
  bsc.id,
]);

export const ALCHEMY_CHAIN_URLS: Record<number, string> = {
  [mainnet.id]: `https://eth-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [base.id]: `https://base-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [polygon.id]: `https://polygon-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [arbitrum.id]: `https://arb-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [bsc.id]: `https://bnb-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
};

export const isAlchemyChain = (chainId: number): boolean =>
  ALCHEMY_SUPPORTED_CHAIN_IDS.has(chainId) && !!ALCHEMY_CHAIN_URLS[chainId];

/**
 * Alchemy network ids, as the Prices API expects them in a
 * `{ network, address }` pair. Same slugs as the RPC subdomains above.
 */
export const ALCHEMY_NETWORKS: Record<number, string> = {
  [mainnet.id]: 'eth-mainnet',
  [base.id]: 'base-mainnet',
  [polygon.id]: 'polygon-mainnet',
  [arbitrum.id]: 'arb-mainnet',
  [bsc.id]: 'bnb-mainnet',
};

export const ALCHEMY_PRICES_URL = `https://api.g.alchemy.com/prices/v1/${EXPO_PUBLIC_ALCHEMY_API_KEY}/tokens`;

/** Addresses per `tokens/by-address` request — Alchemy rejects more than this. */
export const ALCHEMY_PRICE_BATCH_SIZE = 25;

export const ALCHEMY_REQUEST_TIMEOUT_MS = 10_000;
