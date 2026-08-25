import { DEPOSIT_MODAL } from '@/constants/modals';
import { DepositModal, SavingsFundIntent } from '@/lib/types';

/** Tracking source for the card activation screen's minimum-deposit step. */
export const CARD_DEPOSIT_SOURCE = 'card_activation_deposit_step';

/** The deposit-store setters the card's deposit step needs to prime the flow. */
type DepositFlowState = {
  setDepositFromSolid: (v: boolean) => void;
  setSavingsFundIntent: (intent: SavingsFundIntent) => void;
  clearDirectDepositSession: () => void;
};

type OpenDepositFlow = (options: {
  modal: DepositModal;
  source: string;
  buttonText: string;
}) => void;

/**
 * Opens the savings direct-deposit flow from the card's "Deposit at least $5"
 * step: token → network → per-session deposit address, polled for the incoming
 * transfer.
 *
 * This replaced the legacy `OPEN_OPTIONS` route, which led to the static Safe
 * address ("Share your deposit address" → "Your Solid address"). That address is
 * the same for every chain and every purpose, so nothing tied a transfer to this
 * step and the screen could not tell the user their deposit had been seen — they
 * were left watching an unchanging QR and a "5-10 minutes" note. Point this back
 * at `OPEN_OPTIONS` and Bangladesh card applicants get that screen again.
 */
export function openCardSavingsDeposit(
  state: DepositFlowState,
  openDepositFlow: OpenDepositFlow,
): void {
  // Send new money in rather than moving an existing Solid balance, so the flow
  // opens on the token list instead of the deposit-from-Solid form.
  state.setDepositFromSolid(false);

  // Only soUSD counts towards this step (see `savingsDepositMet`), so the flow
  // offers just the stablecoins that mint it.
  state.setSavingsFundIntent('card_deposit');

  // directDepositSession is persisted: drop any token / chain / address left
  // from an earlier deposit so this open starts on the token list with a fresh
  // session, never a stale address for a chain the user is no longer on.
  state.clearDirectDepositSession();

  openDepositFlow({
    modal: DEPOSIT_MODAL.OPEN_SAVINGS_FUND,
    source: CARD_DEPOSIT_SOURCE,
    buttonText: 'Deposit',
  });
}
