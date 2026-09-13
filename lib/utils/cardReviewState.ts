import { EndorsementStatus } from '@/components/BankTransfer/enums';
import { BridgeCustomerEndorsement, CardStatusResponse } from '@/lib/types';
import { isKycAwaitingDecision } from '@/lib/utils/kyc/verificationProgress';

export interface CardIssuanceReviewInput {
  /** Latest `/cards/status` response; the issuance screen polls it. */
  cardStatus: CardStatusResponse | null | undefined;
  /**
   * The deprecated bridge.xyz "cards" endorsement, when the user has one. That
   * flow never reported a KYC status on `/cards/status`, so its review state is
   * only visible here.
   */
  cardsEndorsement: BridgeCustomerEndorsement | undefined;
}

/** The bridge.xyz/Persona review state: an endorsement with pending requirements. */
function hasBridgeEndorsementUnderReview(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
): boolean {
  if (cardsEndorsement?.status !== EndorsementStatus.INCOMPLETE) return false;
  const pending = cardsEndorsement.requirements?.pending;
  return Array.isArray(pending) && pending.length > 0;
}

/**
 * Whether `/card/activate` should show "your card is on its way" in place of its
 * steps list.
 *
 * The steps list is a to-do list, and an applicant waiting on a decision has
 * nothing on it: its first row reads "Complete KYC" behind a disabled button,
 * which lands as an invitation to verify again on someone who has just
 * finished. Worse, every fallback around it (the home setup steps, the `/card`
 * shim) treated "no action on the KYC step" as "start onboarding" and sent them
 * to country selection.
 *
 * Kept as a pure function in a leaf module, like `resolveCardPendingDestination`
 * next door, so the decision can be tested without mounting the screen.
 *
 * Both live issuers are covered by one question — see `isKycAwaitingDecision` —
 * so Rain/Didit and Wirex/Sumsub need no branch of their own here. The
 * endorsement clause is the deprecated bridge.xyz/Persona path, unchanged.
 */
export function isCardIssuanceUnderReview({
  cardStatus,
  cardsEndorsement,
}: CardIssuanceReviewInput): boolean {
  if (hasBridgeEndorsementUnderReview(cardsEndorsement)) return true;

  if (!isKycAwaitingDecision(cardStatus)) return false;

  // Issuance is blocked (e.g. a provider registration that cannot be retried).
  // Only the steps list renders that reason, and a user told their card is on
  // its way would never go looking for it.
  if (cardStatus?.activationBlocked) return false;

  // Verification passed but the application is parked because the deposit is no
  // longer held. The "top up and hold" step is the user's move, and it lives on
  // the steps list.
  if (cardStatus?.rainForwardPendingDeposit) return false;

  return true;
}
