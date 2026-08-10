import { RainApplicationStatus } from '@/lib/types';

/**
 * What the Rain KYC step button should do. Kept as a pure decision so the rules
 * are testable without standing up the whole `useCardSteps` hook.
 */
export type RainKycAction =
  /** LOCKED/CANCELED — a human has to unblock this. */
  | { type: 'support' }
  /** Send the user to Rain's hosted verification/resubmission page. */
  | { type: 'external-link' }
  /** No application yet — create a fresh provider session. */
  | { type: 'start-kyc' }
  /** An action is owed but we have no link to send them to. Tell them. */
  | { type: 'link-unavailable' }
  /** Terminal or in-flight state with nothing for the user to do. */
  | { type: 'none' };

export interface RainKycActionInput {
  rainApplicationStatus?: RainApplicationStatus | null;
  /** A verification link with both a url and at least one signed param. */
  hasUsableLink: boolean;
  /**
   * Whether a provider (Rain) consumer already exists. When it does, creating a
   * new Didit/Sumsub session is refused with 409 KYC_ALREADY_EXISTS, so
   * 'start-kyc' is never a valid answer — resubmissions go through Rain's link.
   */
  kycApplicationEstablished?: boolean;
}

/**
 * Rain KYC step decision.
 *
 * The case that mattered in the field: a user whose Rain application was
 * `needsInformation` (BAD_SELFIE) but whose status never reached the client —
 * masked by a stale bridge.xyz activation block — fell through to 'start-kyc',
 * hit the guaranteed 409, and was stranded on the "Redirecting..." hand-off.
 * A missing status is not evidence that nothing exists, so it can only mean
 * 'start-kyc' when we positively know no consumer has been created.
 */
export function resolveRainKycAction({
  rainApplicationStatus: status,
  hasUsableLink,
  kycApplicationEstablished,
}: RainKycActionInput): RainKycAction {
  // DENIED is final and renders no button at all. PENDING/MANUAL_REVIEW and
  // APPROVED have no user action either.
  if (
    status === RainApplicationStatus.DENIED ||
    status === RainApplicationStatus.APPROVED ||
    status === RainApplicationStatus.PENDING ||
    status === RainApplicationStatus.MANUAL_REVIEW
  ) {
    return { type: 'none' };
  }

  if (status === RainApplicationStatus.LOCKED || status === RainApplicationStatus.CANCELED) {
    return { type: 'support' };
  }

  if (
    status === RainApplicationStatus.NEEDS_VERIFICATION ||
    status === RainApplicationStatus.NEEDS_INFORMATION
  ) {
    return hasUsableLink ? { type: 'external-link' } : { type: 'link-unavailable' };
  }

  // NOT_STARTED, or no status at all.
  if (kycApplicationEstablished) {
    return hasUsableLink ? { type: 'external-link' } : { type: 'link-unavailable' };
  }
  return { type: 'start-kyc' };
}
