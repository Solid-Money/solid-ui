import { createThirdwebClient, defineChain } from 'thirdweb';
import { arbitrum, base, mainnet, polygon } from 'thirdweb/chains';

import { EXPO_PUBLIC_THIRDWEB_CLIENT_ID } from './config';

export const client = createThirdwebClient({
  clientId: EXPO_PUBLIC_THIRDWEB_CLIENT_ID,
});

const fuse = defineChain({
  id: 122,
  rpc: "https://rpc.fuse.io",
  nativeCurrency: {
    name: "Fuse",
    symbol: "FUSE",
    decimals: 18,
  },
  blockExplorers: [
    { 
      name: 'Blockscout',
      url: 'https://explorer.fuse.io',
    },
  ]
});

const chains = [mainnet, fuse, polygon, base, arbitrum];

export const getChain = (chainId: number) => {
  return chains.find(chain => chain.id === chainId);
};
