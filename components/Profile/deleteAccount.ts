import { formatBalanceUSD } from '@/lib/utils';

/**
 * Days between confirming and the account actually closing, or null while
 * deletion is immediate.
 *
 * Today `DELETE /accounts/v1/auths/delete-account` closes the account on the
 * spot and every later sign-in is refused, so promising a window to change
 * your mind would be false. Set this once the backend schedules deletion and
 * lets a sign-in cancel it; the copy on Account details and in the sheet
 * follows.
 */
export const DELETION_GRACE_PERIOD_DAYS: number | null = null;

/** Below this, what is left is dust and does not stand in the way. */
export const BALANCE_DUST_USD = 1;

/** The phrase typed to arm the delete button. */
export const DELETE_CONFIRMATION_PHRASE = 'DELETE';

export type DeleteCheckState = 'ok' | 'blocked' | 'unknown' | 'info' | 'loading';

export interface DeleteAccountCheck {
  id: 'balance' | 'card-payments' | 'card';
  state: DeleteCheckState;
  title: string;
  detail?: string;
  /** Offer the way to clear the check, e.g. "Withdraw". */
  hasAction?: boolean;
}

export interface DeleteAccountCheckInput {
  /** Everything the account holds, card balance included, in USD. */
  balanceUsd: number | undefined;
  isBalanceLoading: boolean;
  /** False when some balance could not be read, so the figure may be low. */
  isBalanceComplete: boolean;
  hasCard: boolean;
  pendingCardPayments: number | undefined;
  isCardPaymentsLoading: boolean;
}

const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * What has to be true before the account can go, and whether it is.
 *
 * Money left behind and payments still settling block deletion: once the
 * account is closed nobody can sign in to move the one or reconcile the other.
 * A check that could not be answered warns rather than blocks — deleting an
 * account is something a user is entitled to do, and a balance endpoint that is
 * down must not take that away from them.
 */
export const getDeleteAccountChecks = ({
  balanceUsd,
  isBalanceLoading,
  isBalanceComplete,
  hasCard,
  pendingCardPayments,
  isCardPaymentsLoading,
}: DeleteAccountCheckInput): { checks: DeleteAccountCheck[]; canDelete: boolean } => {
  const checks: DeleteAccountCheck[] = [];

  if (isBalanceLoading) {
    checks.push({ id: 'balance', state: 'loading', title: 'Checking your balance' });
  } else if (balanceUsd !== undefined && balanceUsd >= BALANCE_DUST_USD) {
    checks.push({
      id: 'balance',
      state: 'blocked',
      title: 'Withdraw your balance',
      detail: `${formatBalanceUSD(balanceUsd)} is still in your account`,
      hasAction: true,
    });
  } else if (balanceUsd === undefined || !isBalanceComplete) {
    checks.push({
      id: 'balance',
      state: 'unknown',
      title: 'Withdraw your balance',
      detail: "We couldn't check every balance. Move out anything left first",
      hasAction: true,
    });
  } else {
    checks.push({ id: 'balance', state: 'ok', title: 'No balance left in your account' });
  }

  if (hasCard) {
    if (isCardPaymentsLoading) {
      checks.push({ id: 'card-payments', state: 'loading', title: 'Checking card payments' });
    } else if (pendingCardPayments === undefined) {
      checks.push({
        id: 'card-payments',
        state: 'unknown',
        title: "Couldn't check card payments",
        detail: 'Make sure none are still pending',
      });
    } else if (pendingCardPayments > 0) {
      checks.push({
        id: 'card-payments',
        state: 'blocked',
        title: 'Wait for card payments to settle',
        detail: `${pluralize(pendingCardPayments, 'payment')} still pending`,
      });
    } else {
      checks.push({ id: 'card-payments', state: 'ok', title: 'No pending card payments' });
    }

    checks.push({
      id: 'card',
      state: 'info',
      title: 'Your card will be cancelled',
      detail: 'It stops working as soon as your account closes',
    });
  }

  const canDelete = checks.every(check => check.state !== 'blocked' && check.state !== 'loading');

  return { checks, canDelete };
};

/** The line under the sheet's title. */
export const getDeleteSheetSubtitle = (hasCard: boolean): string => {
  const closes = hasCard
    ? 'This closes your account and cancels your card.'
    : 'This closes your account.';
  return DELETION_GRACE_PERIOD_DAYS
    ? `${closes} You have ${DELETION_GRACE_PERIOD_DAYS} days to change your mind.`
    : `${closes} It happens straight away and can't be undone.`;
};

/** The note under the Delete account row on Account details. */
export const DELETE_ACCOUNT_FOOTNOTE = DELETION_GRACE_PERIOD_DAYS
  ? `You'll need to withdraw your balance first. Deletion completes ${DELETION_GRACE_PERIOD_DAYS} days after you confirm — sign in before then to cancel.`
  : "You'll need to withdraw your balance first. Deleting your account is immediate and can't be undone.";
