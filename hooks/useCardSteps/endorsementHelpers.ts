import { EndorsementStatus } from '@/components/BankTransfer/enums';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import {
  BridgeCustomerEndorsement,
  BridgeEndorsementIssue,
  BridgeRejectionReason,
} from '@/lib/types';

// ============================================================================
// Issue Formatting Functions
// ============================================================================

/**
 * Format a code string to be user-friendly (replace underscores, capitalize)
 */
function formatCodeToReadable(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Format a single endorsement issue for display
 */
function formatEndorsementIssue(issue: BridgeEndorsementIssue): string {
  if (typeof issue === 'string') {
    return formatCodeToReadable(issue);
  }
  // For objects like { id_front_photo: "id_expired" }
  return Object.entries(issue)
    .map(([field, error]) => `${formatCodeToReadable(field)}: ${formatCodeToReadable(error)}`)
    .join('. ');
}

/**
 * Extract user-friendly messages from rejection reasons
 */
function formatRejectionReasons(rejectionReasons: BridgeRejectionReason[]): string[] {
  return rejectionReasons.map(r => r.reason).filter(r => r && r.trim().length > 0);
}

/**
 * Build issue message - prioritizes rejection reasons over endorsement issues
 */
function buildIssueMessage(
  rejectionReasons: BridgeRejectionReason[] | undefined,
  endorsementIssues: BridgeEndorsementIssue[],
): string {
  // Prefer rejection reasons (user-friendly from Bridge)
  if (rejectionReasons && rejectionReasons.length > 0) {
    const messages = formatRejectionReasons(rejectionReasons);
    if (messages.length > 0) {
      return messages.join('. ');
    }
  }

  // Fall back to sanitized endorsement issues
  if (endorsementIssues.length > 0) {
    return endorsementIssues.map(formatEndorsementIssue).join('. ');
  }

  return 'Additional verification required.';
}

/**
 * Build a user-friendly message for incomplete endorsement requirements
 */
export function buildIncompleteEndorsementMessage(
  missingKeys: string[],
  issues: BridgeEndorsementIssue[],
  rejectionReasons?: BridgeRejectionReason[],
): string {
  const parts: string[] = [];

  if (missingKeys.length > 0) {
    const formattedMissing = missingKeys.map(formatCodeToReadable).join(', ');
    parts.push(`Missing: ${formattedMissing}`);
  }

  // Use consolidated issue message
  const issueMessage = buildIssueMessage(rejectionReasons, issues);
  if (issueMessage !== 'Additional verification required.') {
    parts.push(issueMessage);
  }

  return parts.length > 0 ? parts.join('. ') : 'Additional verification required.';
}

// ============================================================================
// Endorsement Status Checks
// ============================================================================

/**
 * Check if endorsement has pending requirements (under review)
 */
export function hasEndorsementPendingReview(cardsEndorsement: BridgeCustomerEndorsement): boolean {
  const pending = cardsEndorsement.requirements?.pending;
  return Array.isArray(pending) && pending.length > 0;
}

/**
 * Check if user can order a card (only when cards endorsement is approved)
 */
export function canOrderCard(cardsEndorsement: BridgeCustomerEndorsement | undefined): boolean {
  return cardsEndorsement?.status === EndorsementStatus.APPROVED;
}

// ============================================================================
// Analytics Tracking Functions
// ============================================================================

/**
 * Track analytics for approved cards endorsement
 */
function trackApprovedEndorsement(kycLinkId: string | null): void {
  track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
    action: 'blocked',
    reason: 'approved_with_endorsement',
    kycLinkId,
  });
}

/**
 * Track analytics for endorsement with pending review
 */
function trackPendingReviewEndorsement(
  cardsEndorsement: BridgeCustomerEndorsement,
  kycLinkId: string | null,
): void {
  const pendingItems = cardsEndorsement.requirements?.pending || [];

  track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
    action: 'endorsement_pending_review',
    kycLinkId,
    pendingItems,
  });
}

/**
 * Track analytics for revoked cards endorsement
 */
function trackRevokedEndorsement(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
  kycLinkId: string | null,
  rejectionReasons?: BridgeRejectionReason[],
): void {
  const issues = cardsEndorsement?.requirements?.issues || [];

  track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
    action: 'endorsement_revoked',
    kycLinkId,
    issues: issues.map(i => (typeof i === 'string' ? i : Object.keys(i).join(','))),
    hasRejectionReasons: Boolean(rejectionReasons?.length),
  });
}

/**
 * Track analytics for incomplete cards endorsement with missing requirements
 */
function trackIncompleteEndorsement(
  cardsEndorsement: BridgeCustomerEndorsement,
  kycLinkId: string | null,
  rejectionReasons?: BridgeRejectionReason[],
): void {
  const requirements = cardsEndorsement.requirements;
  const missingKeys = requirements?.missing ? Object.keys(requirements.missing) : [];
  const issues = requirements?.issues || [];

  track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
    action: 'incomplete_endorsement',
    kycLinkId,
    missingRequirements: missingKeys,
    issues: issues.map(i => (typeof i === 'string' ? i : Object.keys(i).join(','))),
    hasRejectionReasons: Boolean(rejectionReasons?.length),
  });
}

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Determines if the KYC flow should stop based on endorsement status.
 * Also tracks analytics for each endorsement state.
 *
 * @returns true if flow should STOP (approved or pending review), false to CONTINUE to KYC
 */
export function shouldStopKycFlow(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
  kycLinkId: string | null,
  rejectionReasons?: BridgeRejectionReason[],
): boolean {
  // APPROVED: Stop - user can order card, no need for KYC
  if (cardsEndorsement?.status === EndorsementStatus.APPROVED) {
    trackApprovedEndorsement(kycLinkId);
    return true;
  }

  // REVOKED: Continue - user can retry KYC with another nationality
  if (cardsEndorsement?.status === EndorsementStatus.REVOKED) {
    trackRevokedEndorsement(cardsEndorsement, kycLinkId, rejectionReasons);
    return false;
  }

  // INCOMPLETE: Check if pending review or needs action
  if (cardsEndorsement?.status === EndorsementStatus.INCOMPLETE) {
    if (hasEndorsementPendingReview(cardsEndorsement)) {
      // Pending review: Stop - user should wait
      trackPendingReviewEndorsement(cardsEndorsement, kycLinkId);
      return true;
    }
    // Missing requirements: Continue - user can complete KYC
    trackIncompleteEndorsement(cardsEndorsement, kycLinkId, rejectionReasons);
    return false;
  }

  // No endorsement or unknown status: Continue to KYC
  return false;
}
