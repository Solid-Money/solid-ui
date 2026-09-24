import { covers } from '@/lib/tierUpgrade';

/**
 * What the lock can be paid with.
 *
 * All three are FUSE as far as the tier is concerned — the threshold is
 * measured in FUSE, native and wrapped are par with it, and soFUSE is priced
 * through the vault's rate — which is why the screens quote every amount in
 * FUSE and only this picker mentions the token.
 */
export type LockPaymentAsset = 'FUSE' | 'WFUSE' | 'soFUSE';

/** In the order the picker lists them. */
export const LOCK_PAYMENT_ASSETS: readonly LockPaymentAsset[] = ['FUSE', 'WFUSE', 'soFUSE'];

/**
 * What the picker opens on.
 *
 * Native FUSE: it is what a user holding FUSE has, it needs no prior deposit,
 * and it is the one the zap was built for. soFUSE is the specialist choice —
 * it is already in Savings and locks without a deposit at all — so it is
 * offered rather than assumed.
 */
export const DEFAULT_LOCK_ASSET: LockPaymentAsset = 'FUSE';

/** The Safe's holdings, every one of them denominated in FUSE. */
export interface LockPaymentBalances {
  /** Unlocked soFUSE, valued at the vault's rate. */
  sofuse: number;
  /** Native FUSE. */
  native: number;
  /** WFUSE, which is native FUSE at par — the wrapper holds exactly its supply. */
  wrapped: number;
}

/** The ticker, as the picker and the rows show it. */
export const LOCK_PAYMENT_LABEL: Record<LockPaymentAsset, string> = {
  FUSE: 'FUSE',
  WFUSE: 'WFUSE',
  soFUSE: 'soFUSE',
};

/** The line under the ticker in the picker, saying where the balance lives. */
export const LOCK_PAYMENT_DESCRIPTION: Record<LockPaymentAsset, string> = {
  FUSE: 'Native FUSE in your wallet',
  WFUSE: 'Wrapped FUSE in your wallet',
  soFUSE: 'Already in Savings, locked as-is',
};

/** That asset's balance, in FUSE. */
export const lockPaymentBalance = (
  asset: LockPaymentAsset,
  balances: LockPaymentBalances,
): number =>
  asset === 'soFUSE' ? balances.sofuse : asset === 'FUSE' ? balances.native : balances.wrapped;

/**
 * The assets the picker can offer.
 *
 * FUSE and WFUSE are payable only because the zap deposits and locks in one
 * transaction. Without it the only thing that can be locked is what is already
 * in Savings, so the picker collapses to a single row rather than offering two
 * choices that would revert.
 */
export const availableLockAssets = (zapAvailable: boolean): readonly LockPaymentAsset[] =>
  zapAvailable ? LOCK_PAYMENT_ASSETS : ['soFUSE'];

/**
 * The asset actually in force, given what the user picked.
 *
 * A stored choice outlives the thing that made it possible: the zap can be
 * switched off between one session and the next, and a Safe that still
 * remembers "FUSE" would otherwise build a transaction against a contract the
 * backend no longer names.
 */
export const resolveLockAsset = (
  selected: LockPaymentAsset,
  zapAvailable: boolean,
): LockPaymentAsset => (availableLockAssets(zapAvailable).includes(selected) ? selected : 'soFUSE');

/**
 * Whether that asset's balance covers the lock.
 *
 * One asset, not a combination: the zap takes a single deposit, so an account
 * that could only afford the tier by pooling two of these has to pick one and
 * top it up.
 */
export const canPayLockWith = (
  asset: LockPaymentAsset,
  requiredFuse: number,
  balances: LockPaymentBalances,
): boolean => covers(lockPaymentBalance(asset, balances), requiredFuse);
