import { DEPOSIT_MODAL } from '@/constants/modals';
import { DepositModal, SavingsFundIntent } from '@/lib/types';

/** Tracking source for the card activation screen's minimum-deposit steps. */
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
 * Opens the savings direct-deposit flow from the card's minimum-deposit steps
 * ("Deposit at least $10", and the "top up and hold" step that follows a parked
 * application): token → network → per-session deposit address, polled for the
 * incoming transfer.
 *
 * Deliberately NOT the general "Add funds" sheet (`OPEN_DEPOSIT_TYPE`), and not
 * the static-Safe-address route (`OPEN_OPTIONS` → "Your Solid address") it
 * replaced. Both of those fund the WALLET: tokens sent to the Safe stay as the
 * token that was sent, and this step — like the gate behind it — is judged on
 * soUSD. Sending a user there would leave them looking at a completed transfer
 * and an unmoved step, with nothing on screen explaining the difference.
 *
 * The savings direct-deposit address is per token + chain and is minted by the
 * backend against the PROTOCOL destination, which is what makes the arriving
 * funds mint soUSD, and what lets the screen tell the user their deposit has
 * been seen rather than leaving them watching an unchanging QR.
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
