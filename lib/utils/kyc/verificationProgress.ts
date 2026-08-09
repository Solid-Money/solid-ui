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
