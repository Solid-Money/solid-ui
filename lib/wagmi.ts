polyfill();

import { Platform } from 'react-native';
import { Chain, createPublicClient } from 'viem';
import { createConfig, http } from 'wagmi';
import { arbitrum, base, fuse, mainnet, polygon } from 'wagmi/chains';

import { EXPO_PUBLIC_ALCHEMY_API_KEY } from './config';


const chains: [Chain, ...Chain[]] = [fuse, mainnet, polygon, base, arbitrum];

export const getChain = (chainId: number): Chain | undefined => {
  return chains.find((chain: Chain) => chain.id === chainId);
};

export const rpcUrls: Record<number, string> = {
  [fuse.id]: fuse.rpcUrls.default.http[0],
  [mainnet.id]: `https://eth-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [polygon.id]: `https://polygon-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [base.id]: `https://base-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
  [arbitrum.id]: `https://arb-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
};

const transports: Record<number, ReturnType<typeof http>> = {
  [fuse.id]: http(rpcUrls[fuse.id]),
  [mainnet.id]: http(rpcUrls[mainnet.id]),
  [polygon.id]: http(rpcUrls[polygon.id]),
  [base.id]: http(rpcUrls[base.id]),
  [arbitrum.id]: http(rpcUrls[arbitrum.id]),
};

export const publicClient = (chainId: number) =>
  createPublicClient({
    chain: chains.find(chain => chain.id === chainId),
    transport: http(rpcUrls[chainId]),
  });

export const config = createConfig({
  chains,
  transports,
  // batch: { multicall: true },
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

  const noop = (() => { }) as any;

  window.addEventListener = noop;
  window.dispatchEvent = noop;
  window.removeEventListener = noop;
  window.CustomEvent = function CustomEvent() {
    return {};
  } as any;
}
