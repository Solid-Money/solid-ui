import { EndorsementStatus } from '@/components/BankTransfer/enums';
import {
  BridgeCustomerEndorsement,
  BridgeEndorsementIssue,
  BridgeRejectionReason,
  CardProvider,
  KycStatus,
  KycWarning,
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
 * Map Didit warning tags to user-friendly descriptions.
 * Tags not in the map are formatted by replacing underscores and capitalizing.
 */
const DIDIT_WARNING_DESCRIPTIONS: Record<string, string> = {
  DOCUMENT_EXPIRED: 'Your document has expired',
  DOCUMENT_NOT_SUPPORTED_FOR_APPLICATION: 'This document type is not accepted',
  MINIMUM_AGE_NOT_MET: 'Minimum age requirement not met',
  PORTRAIT_IMAGE_NOT_DETECTED: 'No portrait photo detected on the document',
  ID_DOCUMENT_IN_BLOCKLIST: 'This document has been flagged and cannot be used',
  COULD_NOT_RECOGNIZE_DOCUMENT: 'We could not verify your document',
  MRZ_NOT_DETECTED: 'Could not read the machine-readable zone on your document',
  MRZ_VALIDATION_FAILED: 'Document machine-readable zone is invalid',
  DATA_INCONSISTENT: 'Document data is inconsistent',
  DOCUMENT_SIDES_MISMATCH: 'The front and back of the document do not match',
  SCREEN_CAPTURE_DETECTED: 'A photo of a screen was detected — please use the original document',
  PRINTED_COPY_DETECTED: 'A printed copy was detected — please use the original document',
  PORTRAIT_MANIPULATION_DETECTED: 'The portrait on the document appears to have been altered',
  POSSIBLE_DUPLICATED_USER: 'A duplicate account was detected',
  DOCUMENT_NUMBER_NOT_DETECTED: 'Document number could not be read',
  NAME_NOT_DETECTED: 'Name could not be read from the document',
  DATE_OF_BIRTH_NOT_DETECTED: 'Date of birth could not be read from the document',
  INVALID_DATE: 'A date on the document is invalid',
};

/** Convert a SCREAMING_SNAKE_CASE tag into a Title-Cased phrase. */
function formatRiskTag(tag: string): string {
  return tag
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}

/**
 * Pick the best display text for a single warning:
 *   1. Our DIDIT_WARNING_DESCRIPTIONS override (when we want friendlier wording than Didit's)
 *   2. Didit's `short_description` (always set for documented warnings)
 *   3. Didit's `long_description` (rare fallback if a partial payload arrives)
 *   4. The risk tag formatted into Title Case
 */
function formatDiditWarning(warning: KycWarning): string {
  const risk = warning.risk ?? '';
  if (risk && DIDIT_WARNING_DESCRIPTIONS[risk]) {
    return DIDIT_WARNING_DESCRIPTIONS[risk];
  }
  if (warning.short_description) return warning.short_description;
  if (warning.long_description) return warning.long_description;
  return risk ? formatRiskTag(risk) : '';
}

function formatKycWarnings(warnings: KycWarning[]): string {
  if (!warnings || warnings.length === 0) return '';
  return warnings
    .map(formatDiditWarning)
    .filter(line => line.length > 0)
    .join('\n- ');
}

/**
 * User-friendly KYC description per Rain application state.
 * For NEEDS_INFORMATION, surface the specific rejection reasons (Rain only sends
 * temporary, user-actionable labels for this state). Other states stay generic —
 * final rejections (DENIED/LOCKED/CANCELED) intentionally do not expose the
 * underlying compliance labels (e.g. SANCTIONS, PEP).
 */
export function getKYCDescription(
  rainApplicationStatus?: RainApplicationStatus | null,
  kycWarnings?: KycWarning[] | null,
): string {
  if (!rainApplicationStatus) return DEFAULT_KYC_DESCRIPTION;
  switch (rainApplicationStatus) {
    case RainApplicationStatus.APPROVED:
      return 'Identity verification complete. You can now order your card.';
    case RainApplicationStatus.PENDING:
      return 'Your application is being processed. This usually takes a few minutes.';
    case RainApplicationStatus.MANUAL_REVIEW:
      return "Your application is being reviewed by our team. We'll update you when a decision is reached.";
    case RainApplicationStatus.DENIED:
      return "We couldn't verify your identity. Please contact support for more information.";
    case RainApplicationStatus.LOCKED:
      return 'Your application is on hold. Contact support for assistance.';
    case RainApplicationStatus.CANCELED:
      return 'This application was canceled. Contact support if you need to start over.';
    case RainApplicationStatus.NEEDS_VERIFICATION:
      return "Verify your identity to continue. You'll be redirected to complete verification.";
    case RainApplicationStatus.NEEDS_INFORMATION: {
      const formatted = formatKycWarnings(kycWarnings ?? []);
      if (formatted.length > 0) {
        return `We need a bit more information to process your application:\n- ${formatted}`;
      }
      return 'We need a bit more information to process your application.';
    }
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
  if (!rainApplicationStatus) return 'Continue verification';
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
      return 'Continue verification';
  }
}

/**
 * Whether the KYC button should be disabled for Rain (no action possible)
 */
export function isRainKYCButtonDisabled(
  rainApplicationStatus?: RainApplicationStatus | null,
): boolean {
  if (!rainApplicationStatus) return false;
  // DENIED/LOCKED/CANCELED show "Contact support" and open Intercom — keep enabled
  return (
    rainApplicationStatus === RainApplicationStatus.APPROVED ||
    rainApplicationStatus === RainApplicationStatus.PENDING ||
    rainApplicationStatus === RainApplicationStatus.MANUAL_REVIEW
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
    kycStatus?: KycStatus | null;
    kycWarnings?: KycWarning[] | null;
  },
): string {
  // Only use Rain description for recognized Rain application statuses
  const isRecognizedRainStatus =
    options?.rainApplicationStatus &&
    Object.values(RainApplicationStatus).includes(options.rainApplicationStatus);

  const warnings = options?.kycWarnings ?? [];

  if (options?.cardIssuer === CardProvider.RAIN && isRecognizedRainStatus) {
    return getKYCDescription(options.rainApplicationStatus, warnings);
  }

  // Didit KYC rejected or expired before reaching Rain — show rejection reasons
  if (options?.kycStatus === KycStatus.REJECTED) {
    if (warnings.length > 0) {
      return `We couldn't verify your identity:\n- ${formatKycWarnings(warnings)}`;
    }
    return 'Your identity verification was declined. Please try again with a valid ID.';
  }

  // Didit resubmission or incomplete (including didit_forward_failed) — show reasons if available
  if (options?.kycStatus === KycStatus.INCOMPLETE && !isRecognizedRainStatus) {
    if (warnings.length > 0) {
      return `Additional verification required:\n- ${formatKycWarnings(warnings)}`;
    }
    return 'Additional verification steps are required. Please continue to complete the process.';
  }

  // Didit under review — user should wait
  if (options?.kycStatus === KycStatus.UNDER_REVIEW && !isRecognizedRainStatus) {
    return 'Your information is being reviewed. This usually takes a few minutes.';
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
    kycStatus?: KycStatus | null;
  },
): string | undefined {
  const isRecognizedRainStatus =
    options?.rainApplicationStatus &&
    Object.values(RainApplicationStatus).includes(options.rainApplicationStatus);

  if (options?.cardIssuer === CardProvider.RAIN && isRecognizedRainStatus) {
    return getKYCButtonText(options.rainApplicationStatus);
  }

  // Didit KYC rejected — allow retry
  if (options?.kycStatus === KycStatus.REJECTED) {
    return 'Retry KYC';
  }

  // Didit incomplete — user needs to continue
  if (options?.kycStatus === KycStatus.INCOMPLETE && !isRecognizedRainStatus) {
    return 'Continue verification';
  }

  // Didit under review — disabled, user should wait
  if (options?.kycStatus === KycStatus.UNDER_REVIEW && !isRecognizedRainStatus) {
    return 'Under Review';
  }

  // No endorsement - start KYC
  if (!cardsEndorsement) {
    return 'Continue verification';
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
      return 'Continue verification';

    default:
      return 'Continue verification';
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
    kycStatus?: KycStatus | null;
  },
): boolean {
  const isRecognizedRainStatus =
    options?.rainApplicationStatus &&
    Object.values(RainApplicationStatus).includes(options.rainApplicationStatus);

  if (options?.cardIssuer === CardProvider.RAIN && isRecognizedRainStatus) {
    return isRainKYCButtonDisabled(options.rainApplicationStatus);
  }

  // Didit under review — disable button, user must wait
  if (options?.kycStatus === KycStatus.UNDER_REVIEW && !isRecognizedRainStatus) {
    return true;
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
  return 'Continue verification';
}
