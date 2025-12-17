import { KycStatus } from '@/lib/types';

/**
 * Get the description text for a KYC step based on status
 */
export function getKycDescription(kycStatus: KycStatus, rejectionReasonsText?: string): string {
  if (kycStatus === KycStatus.REJECTED) {
    return (
      rejectionReasonsText ||
      "We couldn't verify your identity. Please review the issues and try again."
    );
  }
  if (kycStatus === KycStatus.PAUSED) {
    return 'KYC paused. Please retry to continue.';
  }
  if (kycStatus === KycStatus.OFFBOARDED) {
    return 'Your account has been offboarded. Please contact support.';
  }
  return 'Identity verification required for us to issue your card';
}

/**
 * Get the button text for a KYC step based on status
 */
export function getKycButtonText(kycStatus: KycStatus): string | undefined {
  if (kycStatus === KycStatus.UNDER_REVIEW) return 'Under Review';
  if (kycStatus === KycStatus.REJECTED) return 'Retry KYC';
  if (kycStatus === KycStatus.PAUSED) return 'Retry KYC';
  if (kycStatus === KycStatus.OFFBOARDED) return undefined;
  return 'Complete KYC';
}
