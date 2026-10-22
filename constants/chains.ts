import { ChainId } from '@cryptoalgebra/fuse-sdk';
import { arbitrum, base, bsc, fuse, mainnet, optimism, polygon } from 'viem/chains';

import { getAsset } from '@/lib/assets';

export const ChainsId = {
  ...ChainId,
  Fuse: 0x7a,
};

export const CHAIN_NAMES: Record<number, string> = {
  [mainnet.id]: 'Ethereum',
  [fuse.id]: 'Fuse',
  [base.id]: 'Base',
  [bsc.id]: 'BNB Chain',
  [polygon.id]: 'Polygon',
  [arbitrum.id]: 'Arbitrum',
  [optimism.id]: 'Optimism',
};

export const CHAIN_ICONS: Record<number, ReturnType<typeof getAsset>> = {
  [mainnet.id]: getAsset('images/eth.png'),
  [fuse.id]: getAsset('images/fuse-4x.png'),
  [base.id]: getAsset('images/base.png'),
  [bsc.id]: getAsset('images/bsc.png'),
  [polygon.id]: getAsset('images/polygon.png'),
  [arbitrum.id]: getAsset('images/arbitrum.png'),
  [optimism.id]: getAsset('images/op.png'),
};
