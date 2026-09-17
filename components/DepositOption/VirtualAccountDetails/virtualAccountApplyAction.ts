import { RainApplicationStatus } from '@/lib/types';

import type { VirtualAccountProvider } from '@/hooks/useVirtualAccountProvider';

/**
 * What the virtual-account pitch's "Verify now" button should do. Kept as a
 * pure decision so the rules are testable without mounting the modal — the same
 * shape as `resolveRainKycAction`, which solved this problem for the card flow.
 */
export type VirtualAccountApplyAction =
  /** Wirex issues this user's account; its details screen owns activation. */
  | { type: 'wirex-details' }
  /** Rain has approved them — straight on to the terms step. */
  | { type: 'rain-tos' }
  /** An application already exists. Show its state; do not start a new check. */
  | { type: 'rain-application' }
  /** Nothing on file — send them to identity verification. */
  | { type: 'start-kyc' };

export interface VirtualAccountApplyActionInput {
  /** Which issuer would open the account. See useVirtualAccountProvider. */
  provider: VirtualAccountProvider;
  rainApplicationStatus?: RainApplicationStatus | string | null;
  /**
   * Whether a provider consumer already exists. When it does, creating a new
   * Didit session is refused with 409 KYC_ALREADY_EXISTS, so 'start-kyc' is
   * never a valid answer.
   */
  kycApplicationEstablished?: boolean;
}

/**
 * Virtual-account "Verify now" decision.
 *
 * The two failures this encodes, both reported from the field as the button
 * doing nothing at all:
 *
 *  - A Wirex user has no Rain application and never will, so every branch below
 *    the Rain-approved one sent them into the Rain KYC flow. Their verification
 *    was already done, so the backend refused a new session and the app dropped
 *    them back out — a spinner, then a card page, no verification ever opened.
 *  - A Rain user who already has a consumer hits the identical 409. A missing
 *    `rainApplicationStatus` is not evidence that nothing exists, so it can
 *    only mean 'start-kyc' when we positively know no consumer was created.
 */
export function resolveVirtualAccountApplyAction({
  provider,
  rainApplicationStatus,
  kycApplicationEstablished,
}: VirtualAccountApplyActionInput): VirtualAccountApplyAction {
  if (provider === 'wirex') return { type: 'wirex-details' };

  if (rainApplicationStatus === RainApplicationStatus.APPROVED) {
    return { type: 'rain-tos' };
  }

  // Rain is waiting on the applicant. The application page carries the link and
  // the reason; a fresh identity check would not be accepted here anyway.
  if (
    rainApplicationStatus === RainApplicationStatus.NEEDS_VERIFICATION ||
    rainApplicationStatus === RainApplicationStatus.NEEDS_INFORMATION
  ) {
    return { type: 'rain-application' };
  }

  if (kycApplicationEstablished) return { type: 'rain-application' };

  return { type: 'start-kyc' };
}
