import { ImageSourcePropType } from "react-native";
import { arbitrum, base, fuse, mainnet, polygon } from "viem/chains";

type BridgeToken = {
  name?: string;
  fullName?: string;
  address: string;
}

type BridgeTokens = {
  [key in number]: {
    tokens?: {
      USDC: BridgeToken;
    }
    name: string;
    icon: ImageSourcePropType;
    sort: number;
    isComingSoon?: boolean;
  }
}

export const BRIDGE_TOKENS: BridgeTokens = {
  [mainnet.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      },
    },
    name: 'Ethereum',
    icon: require('@/assets/images/eth.png'),
    sort: 1,
  },
  [polygon.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
      },
    },
    name: 'Polygon',
    icon: require('@/assets/images/polygon.png'),
    sort: 2,
  },
  [base.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      },
    },
    name: 'Base',
    icon: require('@/assets/images/base.png'),
    sort: 3,
  },
  [arbitrum.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      },
    },
    name: 'Arbitrum',
    icon: require('@/assets/images/arbitrum.png'),
    sort: 4,
  },
  [fuse.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        fullName: 'Stargate USDC.e',
        address: '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9',
      },
    },
    name: 'Fuse',
    icon: require('@/assets/images/fuse.png'),
    sort: 5,
  },
};

export const getUsdcAddress = (chainId: number) => {
  const usdcAddress = BRIDGE_TOKENS[chainId]?.tokens?.USDC?.address;
  if (!usdcAddress) {
    throw new Error(`USDC address not found for chain ${chainId}`);
  }
  return usdcAddress;
};
