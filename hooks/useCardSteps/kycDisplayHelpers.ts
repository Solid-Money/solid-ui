import { EndorsementStatus } from '@/components/BankTransfer/enums';
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
 * Format rejection reasons from customer response
 */
function formatRejectionReasons(rejectionReasons: BridgeRejectionReason[] | undefined): string[] {
  if (!rejectionReasons || rejectionReasons.length === 0) return [];
  return rejectionReasons.map(r => r.reason).filter(r => r && r.trim().length > 0);
}

/**
 * Check if endorsement has pending requirements (under review)
 */
function hasEndorsementPendingReview(cardsEndorsement: BridgeCustomerEndorsement): boolean {
  const pending = cardsEndorsement.requirements?.pending;
  return Array.isArray(pending) && pending.length > 0;
}

/**
 * Check if endorsement has region restriction issue
 */
function hasRegionRestriction(issues: BridgeEndorsementIssue[]): boolean {
  return issues.some(
    issue =>
      (typeof issue === 'string' && issue.toLowerCase().includes('region')) ||
      (typeof issue === 'object' &&
        Object.values(issue).some(v => v.toLowerCase().includes('region'))),
  );
}

// ============================================================================
// Step Description Functions
// ============================================================================

/**
 * Get the description text for the KYC step based on endorsement status
 */
export function getStepDescription(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
  customerRejectionReasons?: BridgeRejectionReason[],
): string {
  // No endorsement yet - default message
  if (!cardsEndorsement) {
    return 'Identity verification required for us to issue your card';
  }

  const requirements = cardsEndorsement.requirements;
  const issues = requirements?.issues || [];
  const missingKeys = requirements?.missing ? Object.keys(requirements.missing) : [];

  // APPROVED - verification complete
  if (cardsEndorsement.status === EndorsementStatus.APPROVED) {
    return 'Identity verification complete. You can now order your card.';
  }

  // REVOKED - show rejection reasons or expiry message
  if (cardsEndorsement.status === EndorsementStatus.REVOKED) {
    // Check for region restriction
    if (hasRegionRestriction(issues)) {
      return 'Card service is not available in your region.';
    }

    // Show customer rejection reasons if available
    const reasons = formatRejectionReasons(customerRejectionReasons);
    if (reasons.length > 0) {
      return `We couldn't verify your identity:\n- ${reasons.join('\n- ')}`;
    }

    // Default expiry message
    return 'Your verification has expired. Please complete the process again within 24 hours of approval.';
  }

  // INCOMPLETE - check if pending review or needs action
  if (cardsEndorsement.status === EndorsementStatus.INCOMPLETE) {
    // Pending review - user should wait
    if (hasEndorsementPendingReview(cardsEndorsement)) {
      return 'Your information is being reviewed. This usually takes a few minutes.';
    }

    // Check for region restriction
    if (hasRegionRestriction(issues)) {
      return 'Card service is not available in your region.';
    }

    // Show what's missing or has issues
    const parts: string[] = [];

    // Customer rejection reasons take priority
    const reasons = formatRejectionReasons(customerRejectionReasons);
    if (reasons.length > 0) {
      return `We couldn't verify your identity:\n- ${reasons.join('\n- ')}`;
    }

    // Missing requirements
    if (missingKeys.length > 0) {
      const formattedMissing = missingKeys.map(formatCodeToReadable).join(', ');
      parts.push(`Missing: ${formattedMissing}`);
    }

    // Issues with submitted data
    if (issues.length > 0) {
      const formattedIssues = issues.map(formatEndorsementIssue).join('. ');
      parts.push(formattedIssues);
    }

    if (parts.length > 0) {
      return `Additional verification required:\n${parts.join('\n')}`;
    }

    // Default message
    return 'Additional information needed to complete verification.';
  }

  // Default fallback
  return 'Identity verification required for us to issue your card';
}

/**
 * Get the button text for the KYC step based on endorsement status
 */
export function getStepButtonText(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
): string | undefined {
  // No endorsement - start KYC
  if (!cardsEndorsement) {
    return 'Complete KYC';
  }

  const issues = cardsEndorsement.requirements?.issues || [];

  switch (cardsEndorsement.status) {
    case EndorsementStatus.APPROVED:
      // Step is complete, no button needed
      return undefined;

    case EndorsementStatus.REVOKED:
      // Check for region restriction - no action possible
      if (hasRegionRestriction(issues)) {
        return undefined;
      }
      return 'Retry KYC';

    case EndorsementStatus.INCOMPLETE:
      // Pending review - user should wait
      if (hasEndorsementPendingReview(cardsEndorsement)) {
        return 'Under Review';
      }
      // Check for region restriction
      if (hasRegionRestriction(issues)) {
        return undefined;
      }
      return 'Complete KYC';

    default:
      return 'Complete KYC';
  }
}

/**
 * Check if the button should be disabled (for pending review or region blocked)
 */
export function isStepButtonDisabled(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
): boolean {
  if (!cardsEndorsement) {
    return false;
  }

  const issues = cardsEndorsement.requirements?.issues || [];

  // Region restriction - disabled
  if (hasRegionRestriction(issues)) {
    return true;
  }

  // Pending review - disabled
  if (
    cardsEndorsement.status === EndorsementStatus.INCOMPLETE &&
    hasEndorsementPendingReview(cardsEndorsement)
  ) {
    return true;
  }

  // Approved - step is complete, button hidden anyway
  if (cardsEndorsement.status === EndorsementStatus.APPROVED) {
    return true;
  }

  return false;
}

// ============================================================================
// Legacy exports for backward compatibility (deprecated)
// ============================================================================

/**
 * @deprecated Use getStepDescription instead
 */
export function getKycDescription(): string {
  return 'Identity verification required for us to issue your card';
}

/**
 * @deprecated Use getStepButtonText instead
 */
export function getKycButtonText(): string | undefined {
  return 'Complete KYC';
}
