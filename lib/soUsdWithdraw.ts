import { Address, Chain, zeroAddress } from 'viem';
import { base, mainnet } from 'viem/chains';

import { ADDRESSES, EXPO_PUBLIC_SOUSD_BASE_WITHDRAWALS } from '@/lib/config';

/**
 * A chain soUSD shares are redeemed on: they bridge there from Fuse, then a
 * withdraw request on that chain's queue swaps them for its USDC.
 *
 * Ethereum was the only one until the vault moved its deposits and withdrawals
 * to Base. It stays here because shares already bridged to Ethereum (by this
 * build or an older one) can only be withdrawn there.
 */
export type SoUsdWithdrawChain = {
  chain: Chain;
  /** How the network is named in the withdraw flow's copy. */
  name: string;
  vault: Address;
  boringQueue: Address;
  usdc: Address;
  /** LayerZero endpoint id the Fuse teller bridges shares to. */
  lzEid: number;
};

export const SOUSD_WITHDRAW_CHAINS: Record<typeof mainnet.id | typeof base.id, SoUsdWithdrawChain> =
  {
    [mainnet.id]: {
      chain: mainnet,
      name: 'Ethereum',
      vault: ADDRESSES.ethereum.vault,
      boringQueue: ADDRESSES.ethereum.boringQueue,
      usdc: ADDRESSES.ethereum.usdc,
      lzEid: 30101,
    },
    [base.id]: {
      chain: base,
      name: 'Base',
      vault: ADDRESSES.base.vault,
      boringQueue: ADDRESSES.base.boringQueue,
      usdc: ADDRESSES.base.usdc,
      lzEid: 30184,
    },
  };

export type SoUsdWithdrawChainId = keyof typeof SOUSD_WITHDRAW_CHAINS;

/** Whether this build has the Base vault and queue to withdraw through. */
export const isSoUsdBaseConfigured =
  ADDRESSES.base.vault !== zeroAddress &&
  ADDRESSES.base.teller !== zeroAddress &&
  ADDRESSES.base.boringQueue !== zeroAddress;

/** Where a withdrawal that starts on Fuse bridges its shares to. */
export const SOUSD_WITHDRAW_CHAIN_ID: SoUsdWithdrawChainId =
  EXPO_PUBLIC_SOUSD_BASE_WITHDRAWALS && isSoUsdBaseConfigured ? base.id : mainnet.id;

/**
 * The withdraw chain for shares sitting on `chainId`, or undefined when shares
 * there cannot be withdrawn directly (Fuse, which bridges first).
 */
export const getSoUsdWithdrawChain = (
  chainId: number | undefined,
): SoUsdWithdrawChainId | undefined => {
  if (chainId === mainnet.id) return mainnet.id;
  if (chainId === base.id && isSoUsdBaseConfigured) return base.id;
  return undefined;
};
