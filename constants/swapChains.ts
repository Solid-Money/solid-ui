import { Address, zeroAddress } from 'viem';
import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { USDC_STARGATE, USDT_STARGATE, WRAPPED_FUSE } from '@/constants/addresses';
import { ADDRESSES, isDevFeatureEnabled } from '@/lib/config';
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

/**
 * Networks LI.FI swaps among with every bridge fee taken from the coin sent,
 * never in ETH or BNB on top: the backend denies the bridges that charge one.
 */
const LIFI_SWAP_NETWORKS: ReadonlySet<number> = new Set([mainnet.id, base.id, bsc.id]);

/**
 * Whether "You get" offers a coin on `toChainId` for one paid on
 * `fromChainId`. Fuse to Fuse is Algebra, and Ethereum, Base and BNB Chain swap
 * among themselves through LI.FI. Fuse to or from any other network waits for
 * Solid's own bridge: LI.FI only reaches Fuse over Stargate, which charges its
 * fee in the other network's native coin.
 */
export const isSwapPairOpen = (fromChainId: number, toChainId: number) =>
  fromChainId === fuse.id || toChainId === fuse.id
    ? fromChainId === toChainId
    : LIFI_SWAP_NETWORKS.has(fromChainId) && LIFI_SWAP_NETWORKS.has(toChainId);

/** Fuse to Fuse stays on Algebra; anything touching another chain goes through LI.FI. */
export const isLifiRoute = (inputChainId: number, outputChainId: number) =>
  inputChainId !== fuse.id || outputChainId !== fuse.id;

export const swapAssetKey = (asset: Pick<SwapAsset, 'chainId' | 'address'>) =>
  `${asset.chainId}:${asset.address.toLowerCase()}`;

/** The pickers' sections. Euro coins are stablecoins too. */
export type SwapAssetCategory = 'stablecoins' | 'earn' | 'crypto';

export interface SwapListing {
  chainId: number;
  address: Address;
  /** The row it joins: "USDC" on every network, "USD Yield" for soUSD. */
  name: string;
  category: SwapAssetCategory;
}

const listed = (
  chainId: number,
  address: Address,
  name: string,
  category: SwapAssetCategory,
): SwapListing => ({ chainId, address, name, category });

/**
 * The swap list: exactly what the new pickers offer, in the order "You get"
 * lists them. By contract rather than symbol, since the catalogue also carries
 * look-alikes that aren't swapped here: Fuse's deprecated bridged USDC and USDT,
 * FUSE bridged to other networks, soUSD and soETH outside Fuse. The catalogue
 * still supplies names, decimals and logos, and has to list each ERC-20 for the
 * backend to quote it.
 */
export const SWAP_LIST: readonly SwapListing[] = [
  // Dollars on all four networks, euros where Circle issues EURC.
  listed(fuse.id, USDC_STARGATE, 'USDC', 'stablecoins'),
  listed(base.id, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'USDC', 'stablecoins'),
  listed(mainnet.id, ADDRESSES.ethereum.usdc, 'USDC', 'stablecoins'),
  listed(bsc.id, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 'USDC', 'stablecoins'),
  listed(fuse.id, USDT_STARGATE, 'USDT', 'stablecoins'),
  listed(base.id, '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', 'USDT', 'stablecoins'),
  listed(mainnet.id, ADDRESSES.ethereum.usdt, 'USDT', 'stablecoins'),
  listed(bsc.id, '0x55d398326f99059fF775485246999027B3197955', 'USDT', 'stablecoins'),
  listed(base.id, '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42', 'EURC', 'stablecoins'),
  listed(mainnet.id, '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c', 'EURC', 'stablecoins'),
  // Crypto: FUSE and WFUSE at home, the rest on Base only. FUSE to WFUSE and
  // back is the old wrap screen; any other Fuse coin reaches WFUSE on Algebra.
  listed(fuse.id, zeroAddress, 'FUSE', 'crypto'),
  listed(fuse.id, WRAPPED_FUSE, 'WFUSE', 'crypto'),
  listed(base.id, zeroAddress, 'ETH', 'crypto'),
  listed(base.id, '0x4200000000000000000000000000000000000006', 'WETH', 'crypto'),
  listed(base.id, '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', 'cbBTC', 'crypto'),
  listed(base.id, '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', 'WBTC', 'crypto'),
  listed(base.id, '0x63706e401c06ac8513145b7687A14804d17f814b', 'AAVE', 'crypto'),
  listed(base.id, '0x58538e6A46E07434d7E7375Bc268D3cb839C0133', 'ENA', 'crypto'),
  listed(base.id, '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82', 'SOL', 'crypto'),
  listed(base.id, '0xc3De830EA07524a0761646a6a4e4be0e114a3C83', 'UNI', 'crypto'),
  // Earn: the Fuse vaults, whose share tokens differ between builds.
  listed(fuse.id, ADDRESSES.fuse.vault, 'USD Yield', 'earn'),
  listed(fuse.id, ADDRESSES.fuse.fuseVault, 'FUSE Yield', 'earn'),
];

const SWAP_LISTINGS = new Map(SWAP_LIST.map(listing => [swapAssetKey(listing), listing]));

/** The swap list's entry for a coin; undefined when it isn't on the list. */
export const swapListing = (asset: { chainId: number; address: string }) =>
  SWAP_LISTINGS.get(`${asset.chainId}:${asset.address.toLowerCase()}`);
