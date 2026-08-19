import { Href } from 'expo-router';

import { path } from '@/constants/path';
import { CardStatus, CardStatusResponse, KycStatus, RainApplicationStatus } from '@/lib/types';

import { getActiveCardRoute, hasCard } from './cardStatusRouting';

/**
 * Which product started KYC. Structurally identical to `KycFlow` in
 * `store/useKycStore`, restated here so this module stays a leaf: importing the
 * store would pull MMKV in and make it untestable under jest-expo, which is the
 * whole reason this decision lives outside the page component.
 */
export type CardPendingKycFlow = 'card' | 'va' | 'transfi';

/**
 * Statuses that mean "the decision is still being made", i.e. the only two the
 * user should be left waiting on.
 *
 * NOT_STARTED is in here because of a timing gap, not because nothing happened:
 * the user lands on the pending page the moment the KYC widget closes, and the
 * provider webhook that moves them to UNDER_REVIEW can be seconds behind. Reading
 * that gap as "nothing to wait for" would bounce them straight back out.
 */
const PENDING_KYC_STATUSES: readonly (KycStatus | undefined)[] = [
  undefined,
  KycStatus.NOT_STARTED,
  KycStatus.UNDER_REVIEW,
  KycStatus.AWAITING_QUESTIONNAIRE,
  KycStatus.AWAITING_UBO,
];

export interface CardPendingRoutingInput {
  /** Latest `/cards/status` response; the page polls it. */
  cardStatus: CardStatusResponse | null | undefined;
  /** Which product started KYC. `va` has its own resume path (the Deposit modal). */
  kycFlow: CardPendingKycFlow | null;
  /**
   * Whether the page is rendering Rain's external verification CTA. That step is
   * the user's to complete right now, so it must not be navigated away from.
   */
  hasRainVerificationCta: boolean;
}

/**
 * Where a user sitting on `/card/pending` should be sent, or `null` to keep
 * waiting.
 *
 * The page polls `/cards/status`, so this runs on every change and is what makes
 * the wait self-terminating: as soon as the KYC decision is no longer pending the
 * user is moved to `/card/activate`, where step one shows the rejection reason
 * and step two opens by itself once KYC passed (`useStepNavigation` opens the
 * first incomplete step). Before this they had to press back to find out.
 */
export function resolveCardPendingDestination({
  cardStatus,
  kycFlow,
  hasRainVerificationCta,
}: CardPendingRoutingInput): Href | null {
  if (!cardStatus) return null;

  // Rain wants an external verification / information step and gave us a usable
  // link — the page renders that CTA, so stay put.
  if (hasRainVerificationCta) return null;

  // Virtual-account KYC is not a card journey: the user re-enters through the
  // Deposit modal, so this page is their terminus.
  if (kycFlow === 'va') return null;

  // Card already issued (status synced while this tab sat open).
  if (hasCard(cardStatus) && cardStatus.status !== CardStatus.PENDING) {
    return getActiveCardRoute(cardStatus);
  }

  const { kycStatus, rainApplicationStatus } = cardStatus;

  // Issuance is blocked (e.g. a provider registration that cannot be retried).
  // The activate page is the only screen that renders the reason, and the status
  // response for a blocked user may carry no kycStatus at all — so this is
  // checked before the status branches below, or the user waits forever on a
  // decision that has already been made.
  if (cardStatus.activationBlocked) {
    return path.CARD_ACTIVATE;
  }

  if (PENDING_KYC_STATUSES.includes(kycStatus)) return null;

  if (kycStatus === KycStatus.APPROVED) {
    // Rain has a second adjudication after KYC. Approved on both → the card is
    // ready to issue; anything else → activate, which renders whichever step
    // Rain is still waiting on.
    return rainApplicationStatus === RainApplicationStatus.APPROVED
      ? path.CARD_READY
      : path.CARD_ACTIVATE;
  }

  // Rejected / paused / offboarded / incomplete. The status rides along in the
  // query so step one renders the outcome rather than generic "verify" copy.
  return `${String(path.CARD_ACTIVATE)}?kycStatus=${kycStatus}` as Href;
}
