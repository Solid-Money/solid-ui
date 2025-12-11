import { arbitrum, base, mainnet, polygon } from 'viem/chains';

export const getStargateChainId = (chainId: number) => {
  switch (chainId) {
    case mainnet.id:
      return 30101;
    case base.id:
      return 30184;
    case polygon.id:
      return 30109;
    case arbitrum.id:
      return 30110;
    default:
      return null;
  }
};

export const getStargateChainKey = (chainId: number) => {
  switch (chainId) {
    case mainnet.id:
      return 'ethereum';
    case base.id:
      return 'base';
    case polygon.id:
      return 'polygon';
    case arbitrum.id:
      return 'arbitrum';
    default:
      return null;
  }
};

export const getStargateToken = (chainId: number) => {
  switch (chainId) {
    case mainnet.id:
      return '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    case base.id:
      return '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    case polygon.id:
      return '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    case arbitrum.id:
      return '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    default:
      return null;
  }
};
