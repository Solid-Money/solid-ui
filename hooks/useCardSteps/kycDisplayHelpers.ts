import { EndorsementStatus } from '@/components/BankTransfer/enums';
import {
  BridgeCustomerEndorsement,
  BridgeEndorsementIssue,
  BridgeRejectionReason,
  CardProvider,
  RainApplicationStatus,
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
// Rain KYC state helpers (application status from Rain API)
// ============================================================================

const DEFAULT_KYC_DESCRIPTION = 'Identity verification required for us to issue your card.';

/**
 * User-friendly KYC description per Rain application state
 */
export function getKYCDescription(
  rainApplicationStatus?: RainApplicationStatus | null,
): string {
  if (!rainApplicationStatus) return DEFAULT_KYC_DESCRIPTION;
  switch (rainApplicationStatus) {
    case RainApplicationStatus.APPROVED:
      return 'Identity verification complete. You can now order your card.';
    case RainApplicationStatus.PENDING:
      return 'Your application is being processed. This usually takes a few minutes.';
    case RainApplicationStatus.MANUAL_REVIEW:
      return 'Your application is being reviewed by our team. We\'ll update you when a decision is reached.';
    case RainApplicationStatus.DENIED:
      return 'We couldn\'t verify your identity. Please contact support for more information.';
    case RainApplicationStatus.LOCKED:
      return 'Your application is on hold. Contact support for assistance.';
    case RainApplicationStatus.CANCELED:
      return 'This application was canceled. Contact support if you need to start over.';
    case RainApplicationStatus.NEEDS_VERIFICATION:
      return 'Verify your identity to continue. You\'ll be redirected to complete verification.';
    case RainApplicationStatus.NEEDS_INFORMATION:
      return 'We need a bit more information to process your application.';
    case RainApplicationStatus.NOT_STARTED:
    default:
      return DEFAULT_KYC_DESCRIPTION;
  }
}

/**
 * KYC step button text per Rain application state
 */
export function getKYCButtonText(
  rainApplicationStatus?: RainApplicationStatus | null,
): string | undefined {
  if (!rainApplicationStatus) return 'Complete KYC';
  switch (rainApplicationStatus) {
    case RainApplicationStatus.APPROVED:
      return undefined;
    case RainApplicationStatus.PENDING:
    case RainApplicationStatus.MANUAL_REVIEW:
      return 'Under Review';
    case RainApplicationStatus.DENIED:
    case RainApplicationStatus.LOCKED:
    case RainApplicationStatus.CANCELED:
      return 'Contact support';
    case RainApplicationStatus.NEEDS_VERIFICATION:
      return 'Complete verification';
    case RainApplicationStatus.NEEDS_INFORMATION:
      return 'Provide information';
    case RainApplicationStatus.NOT_STARTED:
    default:
      return 'Complete KYC';
  }
}

/**
 * Whether the KYC button should be disabled for Rain (no action possible)
 */
export function isRainKYCButtonDisabled(
  rainApplicationStatus?: RainApplicationStatus | null,
): boolean {
  if (!rainApplicationStatus) return false;
  return (
    rainApplicationStatus === RainApplicationStatus.APPROVED ||
    rainApplicationStatus === RainApplicationStatus.PENDING ||
    rainApplicationStatus === RainApplicationStatus.MANUAL_REVIEW ||
    rainApplicationStatus === RainApplicationStatus.DENIED
  );
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
  options?: {
    cardIssuer?: CardProvider | null;
    rainApplicationStatus?: RainApplicationStatus | null;
  },
): string {
  if (options?.cardIssuer === CardProvider.RAIN && options?.rainApplicationStatus) {
    return getKYCDescription(options.rainApplicationStatus);
  }

  // No endorsement yet - default message
  if (!cardsEndorsement) {
    return DEFAULT_KYC_DESCRIPTION;
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
  return DEFAULT_KYC_DESCRIPTION;
}

/**
 * Get the button text for the KYC step based on endorsement status or Rain KYC status
 */
export function getStepButtonText(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
  options?: {
    cardIssuer?: CardProvider | null;
    rainApplicationStatus?: RainApplicationStatus | null;
  },
): string | undefined {
  if (options?.cardIssuer === CardProvider.RAIN && options?.rainApplicationStatus) {
    return getKYCButtonText(options.rainApplicationStatus);
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
  options?: {
    cardIssuer?: CardProvider | null;
    rainApplicationStatus?: RainApplicationStatus | null;
  },
): boolean {
  if (options?.cardIssuer === CardProvider.RAIN && options?.rainApplicationStatus) {
    return isRainKYCButtonDisabled(options.rainApplicationStatus);
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
 * @deprecated Use getStepDescription or getKYCDescription(rainApplicationStatus) instead
 */
export function getKycDescription(): string {
  return DEFAULT_KYC_DESCRIPTION;
}

/**
 * @deprecated Use getStepButtonText instead
 */
export function getKycButtonText(): string | undefined {
  return 'Complete KYC';
}
