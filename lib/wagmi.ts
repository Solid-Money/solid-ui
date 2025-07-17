import { Chain, createPublicClient } from 'viem';
import { createConfig, http } from 'wagmi';
import { fuse, mainnet } from 'wagmi/chains';

import { EXPO_PUBLIC_ALCHEMY_API_KEY } from './config';

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

const transports: Record<number, ReturnType<typeof http>> = {
  [fuse.id]: http(rpcUrls[fuse.id]),
  [mainnet.id]: http(rpcUrls[mainnet.id]),
}

export const publicClient = (chainId: number) => createPublicClient({
  chain: chains.find(chain => chain.id === chainId),
  transport: http(rpcUrls[chainId])
})

export const config = createConfig({
  chains,
  transports
})
