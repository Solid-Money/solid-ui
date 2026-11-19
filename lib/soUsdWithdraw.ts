import { Address, Chain, formatUnits, parseUnits, zeroAddress } from 'viem';
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

/**
 * What a resumed step 2 can withdraw: the amount step 1 sent, or the shares
 * that actually arrived on the withdraw chain when fewer did. The bridge fee
 * comes out of the shares, so fewer always arrive than were sent.
 */
export const resumeWithdrawAmount = (sentAmount: string, arrivedShares?: bigint): string => {
  if (!arrivedShares) return sentAmount;
  return arrivedShares < parseUnits(sentAmount, 6) ? formatUnits(arrivedShares, 6) : sentAmount;
};

/**
 * User copy when step 2 asks for more soUSD than the Safe holds on the withdraw
 * chain, or undefined when it holds enough. The queue would revert otherwise.
 */
export const withdrawShortfallCopy = (
  amount: bigint,
  shares: bigint,
  chainName: string,
): string | undefined => {
  if (amount <= shares) return undefined;
  return shares > 0n
    ? `Only ${formatUnits(shares, 6)} soUSD is on ${chainName}. Withdraw up to that amount.`
    : `There is no soUSD on ${chainName} to withdraw yet.`;
};
