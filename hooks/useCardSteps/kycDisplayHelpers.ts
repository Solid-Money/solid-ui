import { EndorsementStatus } from '@/components/BankTransfer/enums';
import {
  BridgeCustomerEndorsement,
  BridgeEndorsementIssue,
  BridgeRejectionReason,
  CardProvider,
  KycStatus,
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

// ============================================================================
// Step Description Functions
// ============================================================================

/**
 * Get the description text for the KYC step based on endorsement status or Rain KYC status
 */
export function getStepDescription(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
  customerRejectionReasons?: BridgeRejectionReason[],
  options?: { cardIssuer?: CardProvider | null; rainKycStatus?: KycStatus | null },
): string {
  if (options?.cardIssuer === CardProvider.RAIN && options?.rainKycStatus) {
    const s = options.rainKycStatus;
    if (s === KycStatus.APPROVED) return 'Identity verification complete. You can now order your card.';
    if (s === KycStatus.UNDER_REVIEW) return 'Your information is being reviewed. This usually takes a few minutes.';
    if (s === KycStatus.REJECTED) return 'We couldn\'t verify your identity. Please contact support or try again.';
    if (s === KycStatus.OFFBOARDED) return 'Account offboarded. Please contact support.';
    if (s === KycStatus.INCOMPLETE || s === KycStatus.NOT_STARTED) return 'Identity verification required for us to issue your card.';
    return 'Identity verification required for us to issue your card';
  }

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
 * Get the button text for the KYC step based on endorsement status or Rain KYC status
 */
export function getStepButtonText(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
  options?: { cardIssuer?: CardProvider | null; rainKycStatus?: KycStatus | null },
): string | undefined {
  if (options?.cardIssuer === CardProvider.RAIN && options?.rainKycStatus) {
    const s = options.rainKycStatus;
    if (s === KycStatus.APPROVED) return undefined;
    if (s === KycStatus.UNDER_REVIEW) return 'Under Review';
    if (s === KycStatus.REJECTED || s === KycStatus.OFFBOARDED) return 'Contact support';
    return 'Complete KYC';
  }

  // No endorsement - start KYC
  if (!cardsEndorsement) {
    return 'Complete KYC';
  }

  switch (cardsEndorsement.status) {
    case EndorsementStatus.APPROVED:
      // Step is complete, no button needed
      return undefined;

    case EndorsementStatus.REVOKED:
      // Allow retry even for region restrictions (user may have another nationality)
      return 'Retry KYC';

    case EndorsementStatus.INCOMPLETE:
      // Pending review - user should wait
      if (hasEndorsementPendingReview(cardsEndorsement)) {
        return 'Under Review';
      }
      // Allow retry even for region restrictions (user may have another nationality)
      return 'Complete KYC';

    default:
      return 'Complete KYC';
  }
}

/**
 * Check if the button should be disabled (for pending review or Rain under_review)
 */
export function isStepButtonDisabled(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
  options?: { cardIssuer?: CardProvider | null; rainKycStatus?: KycStatus | null },
): boolean {
  if (options?.cardIssuer === CardProvider.RAIN) {
    const s = options.rainKycStatus;
    return s === KycStatus.APPROVED || s === KycStatus.UNDER_REVIEW || false;
  }
  if (!cardsEndorsement) {
    return false;
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
