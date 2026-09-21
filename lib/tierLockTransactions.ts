import { type Address, encodeFunctionData, erc20Abi, type Hex } from 'viem';

import { SolidTierLock_ABI } from '@/lib/abis/SolidTierLock';
import { SolidTierLockZap_ABI, ZAP_NATIVE_ASSET } from '@/lib/abis/SolidTierLockZap';
import { fuseSharesForAmount, fuseSharesMintedFor, fuseToWei } from '@/lib/tierUpgrade';

import type { LockPaymentAsset } from '@/lib/tierLockPayment';

/** One call in the user operation the Safe signs. */
export interface LockTransaction {
  to: Address;
  data: Hex;
  value: bigint;
}

export interface LockTransactionParams {
  asset: LockPaymentAsset;
  /** FUSE the user is committing. */
  fuseAmount: number;
  /** soFUSE→FUSE rate, raw. */
  rate: bigint;
  lockAddress: Address;
  shareTokenAddress: Address;
  /** `SolidTierLockZap`. Required for anything that is not already soFUSE. */
  zapAddress?: Address;
  /** WFUSE. Required to pay with WFUSE. */
  wrappedNativeAddress?: Address;
}

/**
 * The calls that buy a tier by locking, for whichever asset is paying.
 *
 * Three shapes, one user operation each, and the difference between them is
 * where the shares come from:
 *
 *  - **soFUSE** is already shares. Approve them to the lock and lock them. This
 *    is the only route that does not need the zap, which is why it stays the
 *    preferred one.
 *  - **FUSE** goes to the zap as value. The zap deposits it, reads what the
 *    Teller actually minted, and locks that — which is the whole reason it
 *    exists, because a batch cannot read a balance it created.
 *  - **WFUSE** is the same, with an approval in front of it.
 *
 * ## Why the two share counts round opposite ways
 *
 * `shares` (soFUSE) is rounded **up**: the lock takes exactly this many from a
 * balance that already exists, and a share too few leaves the position a wei
 * short of the threshold and buys nothing.
 *
 * `minShares` (the zap) is rounded **down**, because it is a floor on what the
 * Teller will mint and the Teller itself rounds down. Quoted rounded up it
 * would be one wei above what any deposit that does not divide exactly can
 * produce, and every such upgrade would revert. The wei of difference is worth
 * a wei of FUSE against a threshold in the tens of thousands.
 *
 * It is still a real bound: a rate that rises between this quote and the
 * transaction landing mints fewer shares than this, and the zap reverts rather
 * than locking the user in for a year against a position that does not reach
 * the tier. The screen re-reads the rate every few seconds, so the retry is
 * already priced.
 */
export const buildLockTransactions = ({
  asset,
  fuseAmount,
  rate,
  lockAddress,
  shareTokenAddress,
  zapAddress,
  wrappedNativeAddress,
}: LockTransactionParams): LockTransaction[] => {
  if (asset === 'soFUSE') {
    const shares = fuseSharesForAmount(fuseAmount, rate);
    if (shares <= 0n) throw new Error('Enter an amount to lock.');

    return [
      {
        to: shareTokenAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [lockAddress, shares],
        }),
        value: 0n,
      },
      {
        to: lockAddress,
        data: encodeFunctionData({
          abi: SolidTierLock_ABI,
          functionName: 'lock',
          args: [shares],
        }),
        value: 0n,
      },
    ];
  }

  if (!zapAddress) {
    throw new Error('Paying with FUSE is not available right now. Add it to Savings instead.');
  }

  const amountWei = fuseToWei(fuseAmount);
  const minShares = fuseSharesMintedFor(fuseAmount, rate);
  if (amountWei <= 0n || minShares <= 0n) throw new Error('Enter an amount to lock.');

  if (asset === 'FUSE') {
    return [
      {
        to: zapAddress,
        data: encodeFunctionData({
          abi: SolidTierLockZap_ABI,
          functionName: 'zapAndLock',
          args: [ZAP_NATIVE_ASSET, amountWei, minShares],
        }),
        // The zap checks this against the amount, so the two cannot disagree
        // about what is being deposited.
        value: amountWei,
      },
    ];
  }

  if (!wrappedNativeAddress) {
    throw new Error('Paying with WFUSE is not available right now. Add it to Savings instead.');
  }

  return [
    {
      to: wrappedNativeAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [zapAddress, amountWei],
      }),
      value: 0n,
    },
    {
      to: zapAddress,
      data: encodeFunctionData({
        abi: SolidTierLockZap_ABI,
        functionName: 'zapAndLock',
        args: [wrappedNativeAddress, amountWei, minShares],
      }),
      value: 0n,
    },
  ];
};
