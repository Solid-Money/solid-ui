import { CardStatusResponse, KycStatus, RainApplicationStatus } from '@/lib/types';

/**
 * Rain application states the user cannot act on: the application is either
 * finished (approved), being decided (pending / manual review) or closed
 * (denied / locked / canceled). Everything else — needsVerification,
 * needsInformation, notStarted — is still waiting on the user.
 */
const SETTLED_RAIN_STATUSES: RainApplicationStatus[] = [
  RainApplicationStatus.APPROVED,
  RainApplicationStatus.PENDING,
  RainApplicationStatus.MANUAL_REVIEW,
  RainApplicationStatus.DENIED,
  RainApplicationStatus.LOCKED,
  RainApplicationStatus.CANCELED,
];

/**
 * Backend KYC statuses (Didit's decision, before Rain is reached) the user
 * cannot act on. `under_review` / `paused` are waiting on us, and `rejected` /
 * `offboarded` are final — the card steps render no button for any of them
 * (see `isStepButtonDisabled`), so nagging the user to "finish" would be a
 * dead end.
 */
const SETTLED_KYC_STATUSES: KycStatus[] = [
  KycStatus.APPROVED,
  KycStatus.UNDER_REVIEW,
  KycStatus.REJECTED,
  KycStatus.PAUSED,
  KycStatus.OFFBOARDED,
];

function isKnownRainStatus(status: unknown): status is RainApplicationStatus {
  return Object.values(RainApplicationStatus).includes(status as RainApplicationStatus);
}

/**
 * Whether the user has entered identity verification at all.
 *
 * `kycStartedAt` is the local marker written the moment the provider SDK opens
 * (see `useDiditSession`). It matters because a user who opens Didit and walks
 * away leaves no server-side trace for a while — `/cards/status` still reads
 * `not_started` (or 404s into `null`) — yet they are exactly who we want to
 * pull back in.
 */
export function hasStartedKyc(
  cardStatus: CardStatusResponse | null | undefined,
  kycStartedAt: number | null | undefined,
): boolean {
  if (kycStartedAt != null) return true;

  const rainStatus = cardStatus?.rainApplicationStatus;
  if (rainStatus && rainStatus !== RainApplicationStatus.NOT_STARTED) return true;

  const kycStatus = cardStatus?.kycStatus;
  return Boolean(kycStatus) && kycStatus !== KycStatus.NOT_STARTED;
}

/**
 * Whether verification still has a step the user can take. Rain's application
 * status wins whenever it is present — it is the later, more specific stage of
 * the same funnel — and the backend `kycStatus` covers the Didit-only phase
 * before Rain has seen the applicant.
 */
export function hasUnfinishedKyc(cardStatus: CardStatusResponse | null | undefined): boolean {
  const rainStatus = cardStatus?.rainApplicationStatus;
  if (isKnownRainStatus(rainStatus)) return !SETTLED_RAIN_STATUSES.includes(rainStatus);

  const kycStatus = cardStatus?.kycStatus;
  if (kycStatus) return !SETTLED_KYC_STATUSES.includes(kycStatus);

  // No card record yet (`/cards/status` 404s until one exists), so nothing says
  // the user is done.
  return true;
}

/**
 * Whether to nudge the user to finish verification: they started it and still
 * have something to do. Deliberately not shown to users who never started —
 * the wallet card's own "Get your card" panel is the entry point for those.
 */
export function shouldPromptToFinishKyc(
  cardStatus: CardStatusResponse | null | undefined,
  kycStartedAt: number | null | undefined,
): boolean {
  return hasStartedKyc(cardStatus, kycStartedAt) && hasUnfinishedKyc(cardStatus);
}

/**
 * Where the user stands in identity verification, as one value.
 *
 * The home CTA banner needs the whole ladder rather than the single
 * "is there something to finish?" question {@link shouldPromptToFinishKyc}
 * answers: it shows a different card for each rung (Figma 25141:6965), and
 * "waiting on a decision" and "declined" are states of their own there, not just
 * reasons not to nudge.
 *
 * Both card issuers land here. Rain's `rainApplicationStatus` wins whenever it
 * is present — it is the later, more specific stage of the same funnel — and the
 * backend `kycStatus` covers the Didit-only phase before Rain has seen the
 * applicant, as well as the whole Wirex/Sumsub flow, which has no Rain
 * application at all.
 */
export type KycProgress =
  /** Nothing started; no provider has seen this user. */
  | 'not-started'
  /** Started, and the next move is the user's (resubmit, finish a step). */
  | 'unfinished'
  /** Submitted; waiting on the provider or on us. Nothing for the user to do. */
  | 'in-review'
  /** Verified — the user can be issued a card. */
  | 'approved'
  /** Closed against the user: declined, offboarded, locked or canceled. */
  | 'rejected';

/** Rain statuses that closed the application against the user. */
const REJECTED_RAIN_STATUSES: RainApplicationStatus[] = [
  RainApplicationStatus.DENIED,
  RainApplicationStatus.LOCKED,
  RainApplicationStatus.CANCELED,
];

/** Rain statuses that mean a decision is being made. */
const IN_REVIEW_RAIN_STATUSES: RainApplicationStatus[] = [
  RainApplicationStatus.PENDING,
  RainApplicationStatus.MANUAL_REVIEW,
];

/** Backend KYC statuses that are final rejections. */
const REJECTED_KYC_STATUSES: KycStatus[] = [KycStatus.REJECTED, KycStatus.OFFBOARDED];

/** Backend KYC statuses where the decision sits with the provider or with us. */
const IN_REVIEW_KYC_STATUSES: KycStatus[] = [KycStatus.UNDER_REVIEW, KycStatus.PAUSED];

export function resolveKycProgress(
  cardStatus: CardStatusResponse | null | undefined,
  kycStartedAt?: number | null,
): KycProgress {
  const rainStatus = cardStatus?.rainApplicationStatus;
  if (isKnownRainStatus(rainStatus) && rainStatus !== RainApplicationStatus.NOT_STARTED) {
    if (rainStatus === RainApplicationStatus.APPROVED) return 'approved';
    if (REJECTED_RAIN_STATUSES.includes(rainStatus)) return 'rejected';
    if (IN_REVIEW_RAIN_STATUSES.includes(rainStatus)) return 'in-review';
    // needsVerification / needsInformation — Rain is waiting on the user.
    return 'unfinished';
  }

  const kycStatus = cardStatus?.kycStatus;
  if (kycStatus && kycStatus !== KycStatus.NOT_STARTED) {
    if (kycStatus === KycStatus.APPROVED) return 'approved';
    if (REJECTED_KYC_STATUSES.includes(kycStatus)) return 'rejected';
    if (IN_REVIEW_KYC_STATUSES.includes(kycStatus)) return 'in-review';
    // incomplete / awaiting_questionnaire / awaiting_ubo — the user's move.
    return 'unfinished';
  }

  // No usable server status. The local "SDK was opened" marker is the only
  // evidence a user who walked out of Didit/Sumsub leaves behind for a while —
  // `/cards/status` still reads not_started (or 404s into null) — and they are
  // exactly who the "Finish verification" banner is for.
  return hasStartedKyc(cardStatus, kycStartedAt) ? 'unfinished' : 'not-started';
}
