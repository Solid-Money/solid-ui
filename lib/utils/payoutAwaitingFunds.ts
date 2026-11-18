/**
 * `metadata.payout.state` the backend sets on a row whose payout from one of
 * our wallets is waiting for that wallet to be topped up.
 *
 * Today that is a Wirex bank deposit: Wirex reports it complete when the euros
 * reach our account, but the user is paid by our EURC transfer after that.
 * While our wallet cannot cover it, the backend moves the row to `processing`
 * with this flag, retries every minute, and returns it to `success` when the
 * payout lands. It is never a failure and never needs the user to act, so the
 * app calls it "Pending".
 */
export const PAYOUT_AWAITING_FUNDS = 'awaiting_funds';

/** Whether a row's payout is waiting on our payout wallet to be funded. */
export function isPayoutAwaitingFunds(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const payout = (metadata as { payout?: unknown }).payout;
  return (
    !!payout &&
    typeof payout === 'object' &&
    (payout as { state?: unknown }).state === PAYOUT_AWAITING_FUNDS
  );
}
