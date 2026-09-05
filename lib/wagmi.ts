import { Platform } from 'react-native';
import { Chain, createPublicClient } from 'viem';
import { createConfig, http } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';
import { arbitrum, base, baseSepolia, bsc, fuse, mainnet, polygon } from 'wagmi/chains';

import { EXPO_PUBLIC_ALCHEMY_API_KEY } from './config';

polyfill();

const chains: [Chain, ...Chain[]] = [fuse, mainnet, polygon, base, baseSepolia, arbitrum, bsc];

export const getChain = (chainId: number): Chain | undefined => {
  return chains.find((chain: Chain) => chain.id === chainId);
};

export const rpcUrls: Record<number, string> = {
  [fuse.id]: fuse.rpcUrls.default.http[0],
  [mainnet.id]: `https://eth-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [polygon.id]: `https://polygon-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [base.id]: `https://base-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [baseSepolia.id]: `https://base-sepolia.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [arbitrum.id]: `https://arb-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [bsc.id]: `https://bnb-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
};

const transports: Record<number, ReturnType<typeof http>> = {
  [fuse.id]: http(rpcUrls[fuse.id]),
  [mainnet.id]: http(rpcUrls[mainnet.id]),
  [polygon.id]: http(rpcUrls[polygon.id]),
  [base.id]: http(rpcUrls[base.id]),
  [baseSepolia.id]: http(rpcUrls[baseSepolia.id]),
  [arbitrum.id]: http(rpcUrls[arbitrum.id]),
  [bsc.id]: http(rpcUrls[bsc.id]),
};

/**
 * Public clients, one per chain, built on first use and then reused.
 *
 * This used to construct a fresh client (and a fresh transport with it) on every
 * call. `fetchTokenBalances` alone calls it seven times per run, and that run
 * repeats on a timer — so the app was rebuilding the same object graph
 * continuously, and each throwaway transport also threw away whatever request
 * de-duplication it had accumulated.
 *
 * Keyed by chain id; the client is stateless with respect to the caller, so
 * sharing one is safe and is what viem expects.
 */
const createChainClient = (chainId: number) =>
  createPublicClient({
    chain: chains.find(chain => chain.id === chainId),
    transport: http(rpcUrls[chainId]),
  });

// Typed off `createChainClient` rather than `createPublicClient` so the cache
// carries the precise client type viem infers from these arguments. Naming the
// generic-erased `ReturnType<typeof createPublicClient>` here would widen it,
// and callers that pass the client on — `toSafeSmartAccount`, for one — reject
// the widened type.
const publicClients = new Map<number, ReturnType<typeof createChainClient>>();

export const publicClient = (chainId: number) => {
  const cached = publicClients.get(chainId);
  if (cached) return cached;

  const client = createChainClient(chainId);
  publicClients.set(chainId, client);
  return client;
};

export const getWallet = (chainId: number) => {
  return getWalletClient(config, { chainId });
};

export const config = createConfig({
  chains,
  transports,
  // Multicall batching is deliberately not set here: `createConfig` already
  // defaults `batch` to `{ multicall: true }` (see `@wagmi/core`'s
  // `createConfig`, `batch: properties.batch ?? { multicall: true }`), so every
  // `eth_call` routed through this config — the vault `balanceOf` reads, the
  // accountant `getRate` reads — is already aggregated per chain. Passing it
  // explicitly would change nothing.
  //
  // Note this only covers calls made *through this config*. The standalone
  // clients from `publicClient()` above are plain viem clients and batch
  // nothing; that is fine for what they do (`eth_getBalance` is not
  // multicall-able, and their `eth_call`s are one per chain).
});

export const fuseConfig = createConfig({
  chains: [fuse],
  transports: {
    [fuse.id]: http(rpcUrls[fuse.id]),
  },
});

// see: https://github.com/MobileWalletProtocol/smart-wallet-expo-example/blob/ab34404a875fffafb7b1b3e179dd61b22a20490c/src/wagmiDemo.tsx#L122
function polyfill() {
  if (Platform.OS === 'web') return;

  const noop = (() => {}) as any;

  window.addEventListener = noop;
  window.dispatchEvent = noop;
  window.removeEventListener = noop;
  window.CustomEvent = function CustomEvent() {
    return {};
  } as any;
}
