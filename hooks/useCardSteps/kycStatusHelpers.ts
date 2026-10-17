import { useEffect } from 'react';

import { KycStatus } from '@/lib/types';
import { isFinalKycStatus } from '@/lib/utils/kyc';

/**
 * Compute KYC status from the status the KYC screen returned with
 */
export function computeKycStatus(initialKycStatus: KycStatus | undefined): KycStatus {
  return initialKycStatus ?? KycStatus.NOT_STARTED;
}

/**
 * Compute UI KYC status with processing window override
 */
export function computeUiKycStatus(
  processingUntil: number | null,
  kycStatus: KycStatus,
): KycStatus {
  const activeWindow = Boolean(processingUntil && Date.now() < processingUntil);
  return activeWindow ? KycStatus.UNDER_REVIEW : kycStatus;
}

/**
 * Hook to manage the processing window for optimistic KYC status updates
 */
export function useProcessingWindow(
  initialKycStatus: KycStatus | undefined,
  kycStatus: KycStatus,
  processingUntil: number | null,
  setProcessingUntil: (time: number) => void,
  clearProcessingUntil: () => void,
): void {
  // Initialize processing window when returning from redirect
  useEffect(() => {
    if (initialKycStatus && !isFinalKycStatus(kycStatus)) {
      const now = Date.now();
      const windowMs = 90_000;
      const next = now + windowMs;
      if (!processingUntil || processingUntil < now) {
        setProcessingUntil(next);
      }
    }
  }, [initialKycStatus, kycStatus, processingUntil, setProcessingUntil]);

  // Clear processing window on final status
  useEffect(() => {
    if (isFinalKycStatus(kycStatus) && processingUntil) {
      clearProcessingUntil();
    }
  }, [kycStatus, processingUntil, clearProcessingUntil]);
}
