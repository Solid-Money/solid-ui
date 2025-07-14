import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import {
  createAppKit as createAppKitNative,
  defaultWagmiConfig
} from "@reown/appkit-wagmi-react-native";
import { createAppKit } from '@reown/appkit/react';
import { Platform } from 'react-native';
import { Chain, createPublicClient } from 'viem';
import { http } from 'wagmi';
import { fuse, mainnet } from 'wagmi/chains';

import { EXPO_PUBLIC_ALCHEMY_API_KEY, EXPO_PUBLIC_REOWN_PROJECT_ID } from './config';
import { IS_SERVER } from './utils';

const chains: [Chain, ...Chain[]] = [
  fuse,
  mainnet,
]

export const getChain = (chainId: number): Chain | undefined => {
  return chains.find((chain: Chain) => chain.id === chainId);
};

export const rpcUrls: Record<number, string> = {
  [fuse.id]: fuse.rpcUrls.default.http[0],
  [mainnet.id]: `https://eth-mainnet.g.alchemy.com/v2/${EXPO_PUBLIC_ALCHEMY_API_KEY}`,
}

export const publicClient = (chainId: number) => createPublicClient({
  chain: chains.find(chain => chain.id === chainId),
  transport: http(rpcUrls[chainId])
})

const metadata = {
  name: "Solid",
  description: "Your crypto savings app",
  url: Platform.OS === 'web' && !IS_SERVER ? window.location.origin : "https://solid.xyz",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
  redirect: {
    native: "solid://",
    universal: "solid.xyz",
  },
};

const createWagmi = () => {
  if (Platform.OS === 'web') {
    const wagmiAdapter = new WagmiAdapter({
      networks: chains,
      projectId: EXPO_PUBLIC_REOWN_PROJECT_ID,
    })

    return {
      config: wagmiAdapter.wagmiConfig,
      appKit: createAppKit({
        adapters: [wagmiAdapter],
        networks: chains,
        projectId: EXPO_PUBLIC_REOWN_PROJECT_ID,
        metadata,
      })
    }
  } else {
    const wagmiConfig = defaultWagmiConfig({ chains, projectId: EXPO_PUBLIC_REOWN_PROJECT_ID, metadata });

    return {
      config: wagmiConfig,
      appKit: createAppKitNative({
        projectId: EXPO_PUBLIC_REOWN_PROJECT_ID,
        wagmiConfig,
        defaultChain: mainnet
      })
    }
  }
}

export const wagmi = createWagmi();
