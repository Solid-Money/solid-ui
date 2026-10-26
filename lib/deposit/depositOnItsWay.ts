import {
  CROSS_CHAIN_DEPOSIT_METADATA_KEY,
  DELIVERED_BY_BACKEND_METADATA_KEY,
} from '@/constants/transaction';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { normalizeDepositStep } from '@/lib/utils/deposit-steps';

/**
 * USDC deposited into USD Yield from the Solid wallet leaves the wallet at once but
 * reaches Earn minutes later, once the backend has pulled it and deposited it. These
 * helpers read that gap off the deposit's Activity row, so Earn can show the money
 * as on its way instead of missing.
 */

/** After this long a deposit still on its way reads "taking longer" and offers support. */
export const DEPOSIT_TAKING_LONGER_MS = 30 * 60 * 1000;

/** How long a deposit that didn't go through keeps its row, so Earn can say so. */
export const DEPOSIT_FAILED_SHOWN_MS = 24 * 60 * 60 * 1000;

export type DepositOnItsWayState = 'on_its_way' | 'taking_longer' | 'failed';

export interface DepositOnItsWay {
  /** The deposit's Activity row. */
  clientTxId: string;
  /** Dollars: the USDC sent. */
  amount: number;
  state: DepositOnItsWayState;
  /** When it was sent, in ms. */
  sentAt: number;
}

const MOVING_STATUSES: ReadonlySet<TransactionStatus> = new Set([
  TransactionStatus.PENDING,
  TransactionStatus.DETECTED,
  TransactionStatus.PROCESSING,
]);

/** A deposit from the Solid wallet into USD Yield, as useDepositFromSolidUsdc records it. */
export const isUsdYieldWalletDeposit = (activity: ActivityEvent): boolean =>
  activity.type === TransactionType.DEPOSIT &&
  activity.metadata?.vaultShareSymbol === 'soUSD' &&
  activity.metadata?.[DELIVERED_BY_BACKEND_METADATA_KEY] === true;

/**
 * Whether the funds are still moving. A same-chain deposit's only transaction is its
 * approve, and the backend's transaction monitor marks the row SUCCESS from that
 * receipt within seconds; the deposit workflow writes the `complete` step only once
 * the funds are in the vault. So SUCCESS without that step still counts as moving,
 * until the taking-longer mark: past it the row is taken at its word, in case the
 * step never reached the app. The bridge workflow writes no steps, so a cross-chain
 * deposit's SUCCESS stands as it is.
 */
function isStillMoving(activity: ActivityEvent, ageMs: number): boolean {
  if (MOVING_STATUSES.has(activity.status)) return true;
  if (activity.status !== TransactionStatus.SUCCESS) return false;
  if (activity.metadata?.[CROSS_CHAIN_DEPOSIT_METADATA_KEY] === true) return false;
  return (
    normalizeDepositStep(activity.metadata?.depositStep) !== 'complete' &&
    ageMs < DEPOSIT_TAKING_LONGER_MS
  );
}

/** Where one USD Yield deposit stands for Earn, or undefined when it has nothing to show. */
export function getDepositOnItsWay(
  activity: ActivityEvent,
  now: number,
): DepositOnItsWay | undefined {
  if (activity.deleted || !isUsdYieldWalletDeposit(activity)) return undefined;

  const amount = Number(activity.amount);
  const sentAt = Number(activity.timestamp) * 1000;
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(sentAt)) return undefined;

  const age = now - sentAt;
  const deposit = { clientTxId: activity.clientTxId, amount, sentAt };

  if (activity.status === TransactionStatus.FAILED) {
    return age < DEPOSIT_FAILED_SHOWN_MS ? { ...deposit, state: 'failed' } : undefined;
  }
  if (!isStillMoving(activity, age)) return undefined;
  // The backend call failed, so nothing says the funds left: the USDC may still be in
  // the wallet, and "on its way" would be a promise nobody is keeping.
  if (activity.metadata?.depositError) return undefined;

  return { ...deposit, state: age >= DEPOSIT_TAKING_LONGER_MS ? 'taking_longer' : 'on_its_way' };
}

/** Every USD Yield deposit Earn has something to say about, newest first. */
export function depositsOnItsWay(activities: ActivityEvent[], now: number): DepositOnItsWay[] {
  return activities
    .flatMap(activity => {
      const deposit = getDepositOnItsWay(activity, now);
      return deposit ? [deposit] : [];
    })
    .sort((a, b) => b.sentAt - a.sentAt);
}

/** Dollars still headed for USD Yield: what its Yields and Home rows add. */
export const amountOnItsWay = (deposits: DepositOnItsWay[]): number =>
  deposits.reduce((sum, deposit) => (deposit.state === 'failed' ? sum : sum + deposit.amount), 0);

/** Whether any deposit is still moving, as opposed to only failed ones being shown. */
export const hasDepositMoving = (deposits: DepositOnItsWay[]): boolean =>
  deposits.some(deposit => deposit.state !== 'failed');

/**
 * When the list next changes with no new activity, in ms: a deposit turning "taking
 * longer", or a failed one dropping off. Undefined when nothing is waiting on the clock.
 */
export function nextDepositChangeAt(deposits: DepositOnItsWay[]): number | undefined {
  const times = deposits.map(deposit =>
    deposit.state === 'failed'
      ? deposit.sentAt + DEPOSIT_FAILED_SHOWN_MS
      : deposit.state === 'on_its_way'
        ? deposit.sentAt + DEPOSIT_TAKING_LONGER_MS
        : undefined,
  );
  const due = times.filter((time): time is number => time !== undefined);
  return due.length ? Math.min(...due) : undefined;
}
