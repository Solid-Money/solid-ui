import { CardProvider, CardStatusResponse, KycStatus, KycWarning, MainCurrency } from '@/lib/types';

import { canReplaceClosedCard, hasCard, hasPendingCard } from './cardStatusRouting';

/**
 * Where a Wirex applicant is in the card onboarding (Figma "Wirex card onboarding · proposal v2"):
 * Country → What you'll need → Sumsub → Checking → Approved → Activating → Card is live, with the
 * two ways out of it — more documents needed, and declined.
 *
 * - `verify`: nothing submitted yet — the "What you'll need" screen, before Sumsub opens.
 * - `more-documents`: Sumsub asked for a resend; the applicant's move.
 * - `checking`: submitted; Sumsub or Wirex is deciding.
 * - `approved`: verified with no card yet — the Approved screen (`/card/ready`).
 * - `creating`: activated; the issuer has not opened the card yet.
 * - `activation-failed`: approved, but issuing the card failed.
 * - `support`: stuck on our side (the hand-off to Wirex failed for good); only support can move it.
 * - `declined`: a final rejection.
 */
export type WirexOnboardingStep =
  | 'verify'
  | 'more-documents'
  | 'checking'
  | 'approved'
  | 'creating'
  | 'activation-failed'
  | 'support'
  | 'declined';

/**
 * Whether this user gets the Wirex onboarding screens: a Wirex applicant who holds no card.
 *
 * Everyone else keeps today's screens — a Rain applicant, anyone whose issuer is not known yet, and
 * every cardholder. A Wirex cardholder whose card was closed orders the next one from the existing
 * issuance screen, which knows how to replace a card; this flow only ever issues a first one.
 *
 * `prospectiveIssuer` fills the window before `/cards/status` can name the issuer: it 404s until
 * the Sumsub session creates a card customer, and that is exactly when "What you'll need" has to
 * decide to show.
 */
export function isWirexOnboarding(
  cardStatus: CardStatusResponse | null | undefined,
  prospectiveIssuer?: CardProvider | null,
): boolean {
  // A Rain application on the row is Rain's flow, whatever the provider field says.
  if (cardStatus?.rainApplicationStatus) return false;
  if (hasCard(cardStatus) || canReplaceClosedCard(cardStatus)) return false;

  const provider = cardStatus?.provider ?? prospectiveIssuer ?? null;
  return provider === CardProvider.WIREX;
}

/** Statuses where the decision sits with Sumsub, Wirex or us. */
const CHECKING_STATUSES: (KycStatus | undefined)[] = [KycStatus.UNDER_REVIEW, KycStatus.PAUSED];

/** Statuses that close the application against the applicant. */
const DECLINED_STATUSES: (KycStatus | undefined)[] = [KycStatus.REJECTED, KycStatus.OFFBOARDED];

/** Statuses where the next move is the applicant's. */
const MORE_DOCUMENTS_STATUSES: (KycStatus | undefined)[] = [
  KycStatus.INCOMPLETE,
  KycStatus.AWAITING_QUESTIONNAIRE,
  KycStatus.AWAITING_UBO,
];

/**
 * The synthetic warning the backend adds when a hand-off to the issuer failed. It explains an
 * `incomplete` that is not the applicant's to fix — re-opening Sumsub there only finds a check
 * that already passed.
 */
const HANDOFF_FAILED_WARNING = 'CARD_ACTIVATION_FAILED';

/** Which onboarding screen a Wirex applicant belongs on. */
export function resolveWirexOnboardingStep(
  cardStatus: CardStatusResponse | null | undefined,
): WirexOnboardingStep {
  if (hasPendingCard(cardStatus)) return 'creating';

  const kycStatus = cardStatus?.kycStatus;

  if (kycStatus === KycStatus.APPROVED) {
    return cardStatus?.activationBlocked || cardStatus?.activationFailure
      ? 'activation-failed'
      : 'approved';
  }

  if (CHECKING_STATUSES.includes(kycStatus)) return 'checking';
  if (DECLINED_STATUSES.includes(kycStatus)) return 'declined';

  if (MORE_DOCUMENTS_STATUSES.includes(kycStatus)) {
    const handoffFailed =
      cardStatus?.kycRejectType !== 'RETRY' &&
      (cardStatus?.kycWarnings ?? []).some(warning => warning.risk === HANDOFF_FAILED_WARNING);
    return handoffFailed ? 'support' : 'more-documents';
  }

  return 'verify';
}

/**
 * Countries that pay in euros: the euro area (Bulgaria joined on 1 January 2026) and the
 * microstates and territories that use the euro as their currency.
 */
export const EURO_COUNTRIES: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
  // Outside the EU, on the euro all the same.
  'AD',
  'ME',
  'MC',
  'SM',
  'VA',
  'XK',
]);

/**
 * The card currency the Approved screen starts on: euros where people are paid and pay in euros,
 * dollars everywhere else. Only a suggestion — the applicant can change it before activating.
 */
export function suggestedCardCurrency(countryCode?: string | null): MainCurrency {
  return countryCode && EURO_COUNTRIES.has(countryCode.trim().toUpperCase()) ? 'EUR' : 'USD';
}

/** What a resubmission request is about, in the words the "More documents needed" screen uses. */
type ResubmissionTopic = 'address' | 'id' | 'selfie';

const RESUBMISSION_TOPIC: Record<string, ResubmissionTopic> = {
  BAD_PROOF_OF_ADDRESS: 'address',
  WRONG_ADDRESS: 'address',
  BAD_PROOF_OF_IDENTITY: 'id',
  BLACK_AND_WHITE: 'id',
  DOCUMENT_DAMAGED: 'id',
  DOCUMENT_PAGE_MISSING: 'id',
  EXPIRATION_DATE: 'id',
  GRAPHIC_EDITOR: 'id',
  ID_INVALID: 'id',
  SCREENSHOTS: 'id',
  UNFILLED_ID: 'id',
  UNSATISFACTORY_PHOTOS: 'id',
  BAD_FACE_MATCHING: 'selfie',
  BAD_SELFIE: 'selfie',
  BAD_VIDEO_SELFIE: 'selfie',
  SELFIE_MISMATCH: 'selfie',
  UNSUITABLE_ENV: 'selfie',
};

const RESUBMISSION_COPY: Record<ResubmissionTopic, { title: string; body: string }> = {
  address: {
    title: 'We need one more document',
    body: 'Your proof of address wasn’t accepted. Upload a clear, recent bank statement or utility bill that shows your name and address.',
  },
  id: {
    title: 'We need a clearer photo of your ID',
    body: 'Your ID wasn’t accepted. Take a clear, colour photo of the original document that is still valid, with every corner showing.',
  },
  selfie: {
    title: 'We need a new selfie',
    body: 'Your selfie didn’t pass. Retake it in good light, on your own, with your face clearly visible.',
  },
};

/**
 * Labels that are a compliance decision rather than something to fix. Never repeated back to the
 * applicant: they are not actionable, and naming them ("flagged as a politically exposed person")
 * is a disclosure the Rain flow has always avoided.
 */
const UNSHOWN_LABELS = new Set([
  'ADVERSE_MEDIA',
  'AGE_REQUIREMENT_MISMATCH',
  'BLOCKLIST',
  'COMPROMISED_PERSONS',
  'CRIMINAL',
  'DUPLICATE',
  'EXPERIENCE_REQUIREMENT_MISMATCH',
  'FORGERY',
  'FRAUDULENT_PATTERNS',
  'PEP',
  'REGULATIONS_VIOLATIONS',
  'SANCTIONS',
  'WRONG_USER_REGION',
  HANDOFF_FAILED_WARNING,
]);

const GENERIC_RESUBMISSION = {
  title: 'We need a bit more from you',
  body: 'Our verification partner needs another look at your details. Continue to see what to upload.',
};

/**
 * The title and reason on the "More documents needed" screen.
 *
 * Proof of address is two-thirds of resubmissions, so the screen names it in plain words rather
 * than in the label's. A topic the app does not word itself falls back to the backend's own
 * description, and compliance labels are never shown at all.
 */
export function describeResubmission(warnings?: KycWarning[] | null): {
  title: string;
  body: string;
} {
  const shown = (warnings ?? []).filter(warning => !UNSHOWN_LABELS.has(warning.risk));

  const topics = new Set(
    shown
      .map(warning => RESUBMISSION_TOPIC[warning.risk])
      .filter((topic): topic is ResubmissionTopic => Boolean(topic)),
  );

  if (topics.size === 1) return RESUBMISSION_COPY[[...topics][0]];

  if (topics.size > 1) {
    return {
      title: 'We need a few more details',
      body: [...topics].map(topic => RESUBMISSION_COPY[topic].body).join(' '),
    };
  }

  const described = shown.find(warning => warning.short_description?.trim());
  if (described?.short_description) {
    return { title: GENERIC_RESUBMISSION.title, body: described.short_description.trim() };
  }

  return GENERIC_RESUBMISSION;
}

/**
 * Whether the applicant has opened the identity check at all, for a Wirex applicant on the
 * `verify` step. Sumsub reports `init` once the applicant exists; anything there means they have
 * been in, which is what the Home banner's "Finish getting your card" is for.
 */
export function hasOpenedWirexCheck(cardStatus: CardStatusResponse | null | undefined): boolean {
  return Boolean(cardStatus?.kycReviewStatus);
}
