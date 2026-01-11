import { createThirdwebClient, defineChain } from 'thirdweb';
import { arbitrum, base, mainnet, polygon } from 'thirdweb/chains';

import { darkTheme } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
import { EXPO_PUBLIC_THIRDWEB_CLIENT_ID } from './config';

export const client = createThirdwebClient({
  clientId: EXPO_PUBLIC_THIRDWEB_CLIENT_ID,
});

export const thirdwebWallets = [
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('me.rainbow'),
  createWallet('io.rabby'),
  createWallet('io.zerion.wallet'),
  createWallet('com.trustwallet.app'),
];

export const thirdwebTheme = darkTheme({
  colors: {
    accentText: "hsl(109, 82%, 72%)"
  },
});

const fuse = defineChain({
  id: 122,
  name: 'Fuse',
  nativeCurrency: {
    name: 'Fuse',
    symbol: 'FUSE',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.fuse.io'] },
  },
  blockExplorers: {
    default: {
      name: 'Fuse Explorer',
      url: 'https://explorer.fuse.io',
      apiUrl: 'https://explorer.fuse.io/api',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 16146628,
    },
  },
});

const chains = [mainnet, fuse, polygon, base, arbitrum];

export const getChain = (chainId: number) => {
  return chains.find(chain => chain.id === chainId);
};

export const cleanupThirdwebStyles = () => {
  if (typeof document !== 'undefined') {
    document.body.style.pointerEvents = '';
  }
};
