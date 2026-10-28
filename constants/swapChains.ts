import { Address, zeroAddress } from 'viem';
import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { isDevFeatureEnabled } from '@/lib/config';
import { SwapAsset } from '@/lib/types/lifi-swap';

/**
 * The redesigned swap: one form for every network, asset-first pickers, a
 * review screen and a done screen. On qa/preview builds while it's checked;
 * production keeps the current form until then.
 */
export const NEW_SWAP_FLOW = isDevFeatureEnabled;

/**
 * Chains the swap form offers, in picker order: the ones the wallet reads
 * balances on and the backend quotes on. Fuse first, as the app's home chain.
 */
export const SWAP_CHAIN_IDS: readonly number[] = [
  fuse.id,
  base.id,
  mainnet.id,
  arbitrum.id,
  polygon.id,
  bsc.id,
];

/**
 * Native currency on each swap chain, at the zero address the wallet, Algebra
 * and LI.FI all use for it. Not in the swaptokens catalogue: the backend
 * accepts native on any swap chain without a listing.
 */
export const NATIVE_SWAP_ASSETS: Record<number, SwapAsset> = {
  [fuse.id]: native(fuse.id, 'FUSE', 'Fuse'),
  [base.id]: native(base.id, 'ETH', 'Ether'),
  [mainnet.id]: native(mainnet.id, 'ETH', 'Ether'),
  [arbitrum.id]: native(arbitrum.id, 'ETH', 'Ether'),
  [polygon.id]: native(polygon.id, 'POL', 'POL'),
  [bsc.id]: native(bsc.id, 'BNB', 'BNB'),
};

function native(chainId: number, symbol: string, name: string): SwapAsset {
  return {
    chainId,
    address: zeroAddress as Address,
    symbol,
    name,
    decimals: 18,
    isNative: true,
  };
}

/** Fuse to Fuse stays on Algebra; anything touching another chain goes through LI.FI. */
export const isLifiRoute = (inputChainId: number, outputChainId: number) =>
  inputChainId !== fuse.id || outputChainId !== fuse.id;

export const swapAssetKey = (asset: Pick<SwapAsset, 'chainId' | 'address'>) =>
  `${asset.chainId}:${asset.address.toLowerCase()}`;
