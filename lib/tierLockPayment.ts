import { covers } from '@/lib/tierUpgrade';

/** What the lock can be paid with. All three are worth FUSE, one way or another. */
export type LockPaymentAsset = 'soFUSE' | 'FUSE' | 'WFUSE';

/** The Safe's holdings, every one of them denominated in FUSE. */
export interface LockPaymentBalances {
  /** Unlocked soFUSE, valued at the vault's rate. */
  sofuse: number;
  /** Native FUSE. */
  native: number;
  /** WFUSE, which is native FUSE at par — the wrapper holds exactly its supply. */
  wrapped: number;
}

/** How each asset is named to the user. */
export const LOCK_PAYMENT_LABEL: Record<LockPaymentAsset, string> = {
  soFUSE: 'soFUSE in Savings',
  FUSE: 'FUSE',
  WFUSE: 'WFUSE',
};

/** That asset's balance, in FUSE. */
export const lockPaymentBalance = (
  asset: LockPaymentAsset,
  balances: LockPaymentBalances,
): number =>
  asset === 'soFUSE' ? balances.sofuse : asset === 'FUSE' ? balances.native : balances.wrapped;

/**
 * Which asset pays for the lock.
 *
 * soFUSE first, always. It is already in Savings, so it needs no deposit and no
 * rate conversion — the shares that exist are the shares that get locked — and
 * it is the only asset that works when the zap is not deployed. Preferring it
 * also means a user who keeps FUSE liquid on purpose is not quietly spent out
 * of it while their Savings sit untouched.
 *
 * Then native FUSE, then WFUSE. Both go through the zap, which deposits and
 * locks in one transaction; the order between them is arbitrary and native is
 * first only because it is what a user is more likely to be holding.
 *
 * One asset, not a combination. The zap takes a single deposit, so an account
 * that can only afford the tier by pooling two of these has to top one up —
 * which is what the shortfall line says, measured against the best of them.
 *
 * Returns null when nothing covers it on its own.
 */
export const chooseLockPayment = (
  requiredFuse: number,
  balances: LockPaymentBalances,
  /** Whether the deposit-and-lock zap is available. Without it, only soFUSE works. */
  zapAvailable: boolean,
): LockPaymentAsset | null => {
  if (covers(balances.sofuse, requiredFuse)) return 'soFUSE';
  if (!zapAvailable) return null;
  if (covers(balances.native, requiredFuse)) return 'FUSE';
  if (covers(balances.wrapped, requiredFuse)) return 'WFUSE';

  return null;
};

/**
 * The asset the lock would come from if it could be paid at all.
 *
 * `chooseLockPayment` answers "what pays for this", and returns null when
 * nothing does. This answers the different question the screen still has to
 * show something for: which balance is the one worth talking about. Ties go to
 * soFUSE, for the same reason it is preferred when it covers the tier.
 */
export const bestLockPaymentAsset = (
  balances: LockPaymentBalances,
  zapAvailable: boolean,
): LockPaymentAsset => {
  if (!zapAvailable) return 'soFUSE';

  if (balances.native > balances.sofuse && balances.native >= balances.wrapped) return 'FUSE';
  if (balances.wrapped > balances.sofuse && balances.wrapped > balances.native) return 'WFUSE';

  return 'soFUSE';
};

/**
 * The largest single balance the lock could be paid from.
 *
 * What the shortfall is measured against: telling a user holding 80,000 FUSE
 * that they are 90,000 short — because the shortfall was measured against their
 * empty Savings — is worse than telling them nothing.
 */
export const bestLockPaymentBalance = (
  balances: LockPaymentBalances,
  zapAvailable: boolean,
): number => lockPaymentBalance(bestLockPaymentAsset(balances, zapAvailable), balances);
