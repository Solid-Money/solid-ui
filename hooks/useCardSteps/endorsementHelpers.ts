import { EndorsementStatus } from '@/components/BankTransfer/enums';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import {
  BridgeCustomerEndorsement,
  BridgeEndorsementIssue,
  BridgeRejectionReason,
} from '@/lib/types';
import Toast from 'react-native-toast-message';

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
 * Check if issues contain a region restriction
 */
function hasRegionRestriction(issues: BridgeEndorsementIssue[]): boolean {
  return issues.some(
    issue =>
      (typeof issue === 'string' && issue.toLowerCase().includes('region')) ||
      (typeof issue === 'object' &&
        Object.values(issue).some(v => v.toLowerCase().includes('region'))),
  );
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
// Endorsement Status Handlers
// ============================================================================

/**
 * Handle approved cards endorsement - show success toast
 * @returns true if flow should stop (user can order card)
 */
export function handleApprovedEndorsement(kycLinkId: string | null): boolean {
  track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
    action: 'blocked',
    reason: 'approved_with_endorsement',
    kycLinkId,
  });
  Toast.show({
    type: 'success',
    text1: 'Verification complete',
    text2: 'You can now order your card.',
    props: { badgeText: '' },
  });
  return true;
}

/**
 * Handle endorsement with pending review - show pending toast and stop flow
 * @returns true to stop the flow (user should wait)
 */
export function handlePendingReviewEndorsement(
  cardsEndorsement: BridgeCustomerEndorsement,
  kycLinkId: string | null,
): boolean {
  const pendingItems = cardsEndorsement.requirements?.pending || [];

  track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
    action: 'endorsement_pending_review',
    kycLinkId,
    pendingItems,
  });

  Toast.show({
    type: 'info',
    text1: 'Verification in progress',
    text2: 'Your information is being reviewed. This usually takes a few minutes.',
    props: { badgeText: '' },
  });

  return true; // Stop flow - user should wait
}

/**
 * Handle revoked cards endorsement
 * @returns true if blocked (region restriction), false to continue to KYC link
 */
export function handleRevokedEndorsement(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
  kycLinkId: string | null,
  rejectionReasons?: BridgeRejectionReason[],
): boolean {
  const issues = cardsEndorsement?.requirements?.issues || [];

  track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
    action: 'endorsement_revoked',
    kycLinkId,
    issues: issues.map(i => (typeof i === 'string' ? i : Object.keys(i).join(','))),
  });

  // Check if revoked due to region restriction - can't proceed
  if (hasRegionRestriction(issues)) {
    Toast.show({
      type: 'error',
      text1: 'Region not supported',
      text2: 'Card service is not available in your region.',
      props: { badgeText: '' },
    });
    return true;
  }

  // Show rejection reasons if available, otherwise default 24h message
  const message =
    rejectionReasons && rejectionReasons.length > 0
      ? buildIssueMessage(rejectionReasons, issues)
      : 'Please complete verification again. Remember to order your card within 24 hours.';

  Toast.show({
    type: 'warning',
    text1: 'Verification expired',
    text2: message,
    props: { badgeText: '' },
  });

  return false; // Continue to KYC link
}

/**
 * Handle incomplete cards endorsement with missing requirements
 * @returns true if blocked (region restriction), false to continue to KYC link
 */
export function handleIncompleteEndorsement(
  cardsEndorsement: BridgeCustomerEndorsement,
  kycLinkId: string | null,
  rejectionReasons?: BridgeRejectionReason[],
): boolean {
  const requirements = cardsEndorsement.requirements;
  const missingKeys = requirements?.missing ? Object.keys(requirements.missing) : [];
  const issues = requirements?.issues || [];

  track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
    action: 'incomplete_endorsement',
    kycLinkId,
    missingRequirements: missingKeys,
    issues: issues.map(i => (typeof i === 'string' ? i : Object.keys(i).join(','))),
  });

  // Check for region restriction - can't proceed
  if (hasRegionRestriction(issues)) {
    Toast.show({
      type: 'error',
      text1: 'Region not supported',
      text2: 'Card service is not available in your region.',
      props: { badgeText: '' },
    });
    return true;
  }

  const message = buildIncompleteEndorsementMessage(missingKeys, issues, rejectionReasons);

  Toast.show({
    type: 'info',
    text1: 'Additional information needed',
    text2: message,
    props: { badgeText: '' },
  });

  return false; // Continue to KYC link
}

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process cards endorsement status and handle accordingly
 * @param cardsEndorsement - The cards endorsement object
 * @param kycLinkId - KYC link ID for tracking
 * @param rejectionReasons - Optional rejection reasons from customer (prioritized for messaging)
 * @returns true if the flow should stop (approved, pending review, or blocked), false to continue to KYC
 */
export function processCardsEndorsement(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
  kycLinkId: string | null,
  rejectionReasons?: BridgeRejectionReason[],
): boolean {
  // Only approved endorsement allows card ordering
  if (cardsEndorsement?.status === EndorsementStatus.APPROVED) {
    return handleApprovedEndorsement(kycLinkId);
  }

  if (cardsEndorsement?.status === EndorsementStatus.REVOKED) {
    return handleRevokedEndorsement(cardsEndorsement, kycLinkId, rejectionReasons);
  }

  if (cardsEndorsement?.status === EndorsementStatus.INCOMPLETE) {
    // Check if there are pending items (under review)
    if (hasEndorsementPendingReview(cardsEndorsement)) {
      return handlePendingReviewEndorsement(cardsEndorsement, kycLinkId);
    }
    // Otherwise, there are missing requirements - direct user to KYC
    return handleIncompleteEndorsement(cardsEndorsement, kycLinkId, rejectionReasons);
  }

  return false; // No endorsement or unknown status, continue to KYC
}
