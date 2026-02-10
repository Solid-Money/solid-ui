import { ImageSourcePropType } from 'react-native';
import { NATIVE_TOKEN_ADDRESS } from 'thirdweb';
import { arbitrum, base, fuse, mainnet, polygon } from 'viem/chains';

import { WRAPPED_FUSE } from '@/constants/addresses';

type BridgeToken = {
  name?: string;
  fullName?: string;
  address: string;
  icon?: ImageSourcePropType;
  version?: string;
  isPermit?: boolean;
};

type BridgeTokens = {
  [key in number]: {
    tokens?: Record<string, BridgeToken>;
    name: string;
    icon: ImageSourcePropType;
    sort: number;
    isComingSoon?: boolean;
    bridgeSpeed?: number;
  };
};

export const BRIDGE_TOKENS: BridgeTokens = {
  [mainnet.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        version: '2',
        isPermit: false,
      },
      USDT: {
        name: 'USDT',
        fullName: 'Tether USD',
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        icon: require('@/assets/images/usdt.png'),
        isPermit: false,
      },
    },
    name: 'Ethereum',
    icon: require('@/assets/images/eth.png'),
    sort: 1,
    bridgeSpeed: 2,
  },
  [polygon.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        version: '2',
        isPermit: false,
      },
      USDT: {
        name: 'USDT',
        fullName: 'Tether USD',
        address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        icon: require('@/assets/images/usdt.png'),
        version: '1',
        isPermit: false,
      },
    },
    name: 'Polygon',
    icon: require('@/assets/images/polygon.png'),
    sort: 2,
    bridgeSpeed: 2,
  },
  [base.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        version: '2',
        isPermit: false,
      },
    },
    name: 'Base',
    icon: require('@/assets/images/base.png'),
    sort: 3,
    bridgeSpeed: 2,
  },
  [arbitrum.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        version: '2',
        isPermit: false,
      },
      USDT: {
        name: 'USDT',
        fullName: 'Tether USD',
        address: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
        icon: require('@/assets/images/usdt.png'),
        version: '1',
        isPermit: false,
      },
    },
    name: 'Arbitrum',
    icon: require('@/assets/images/arbitrum.png'),
    sort: 4,
    bridgeSpeed: 2,
  },
  [fuse.id]: {
    tokens: {
      FUSE: {
        name: 'FUSE',
        fullName: 'FUSE',
        address: NATIVE_TOKEN_ADDRESS,
        icon: require('@/assets/images/fuse-4x.png'),
      },
      USDC: {
        name: 'USDC',
        fullName: 'Stargate USDC.e',
        address: '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9',
        version: '2',
      },
      USDT: {
        name: 'USDT',
        fullName: 'Stargate USDT',
        address: '0x3695Dd1D1D43B794C0B13eb8be8419Eb3ac22bf7',
        icon: require('@/assets/images/usdt.png'),
        version: '1',
        isPermit: false,
      },
      WFUSE: {
        name: 'WFUSE',
        fullName: 'Wrapped FUSE',
        address: WRAPPED_FUSE,
        icon: require('@/assets/images/fuse-4x.png'),
      },
    },
    name: 'Fuse',
    icon: require('@/assets/images/fuse.png'),
    sort: 5,
    bridgeSpeed: 0,
  },
};

export const getUsdcAddress = (chainId: number) => {
  const usdcAddress = BRIDGE_TOKENS[chainId]?.tokens?.USDC?.address;
  if (!usdcAddress) {
    throw new Error(`USDC address not found for chain ${chainId}`);
  }
  return usdcAddress;
};

export const getBridgeChain = (chainId: number) => {
  return BRIDGE_TOKENS[chainId];
};
