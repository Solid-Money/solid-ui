import { ChainId } from '@cryptoalgebra/fuse-sdk';
import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

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
};

export const CHAIN_ICONS: Record<number, ReturnType<typeof getAsset>> = {
  [mainnet.id]: getAsset('images/eth.png'),
  [fuse.id]: getAsset('images/fuse-4x.png'),
  [base.id]: getAsset('images/base.png'),
  [bsc.id]: getAsset('images/bsc.png'),
};
