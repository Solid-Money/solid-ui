import {
  KycLinkFromBridgeResponse,
  KycStatus,
  RainApplicationStatus,
} from '@/lib/types';
import { isFinalKycStatus } from '@/lib/utils/kyc';
import { useEffect } from 'react';

/** Map Rain API application status to frontend KycStatus */
export function rainApplicationStatusToKycStatus(
  status: RainApplicationStatus | undefined,
): KycStatus | null {
  if (!status) return null;
  const map: Record<RainApplicationStatus, KycStatus> = {
    approved: KycStatus.APPROVED,
    pending: KycStatus.UNDER_REVIEW,
    manualReview: KycStatus.UNDER_REVIEW,
    denied: KycStatus.REJECTED,
    locked: KycStatus.UNDER_REVIEW,
    canceled: KycStatus.REJECTED,
    needsVerification: KycStatus.INCOMPLETE,
    needsInformation: KycStatus.INCOMPLETE,
    notStarted: KycStatus.NOT_STARTED,
  };
  return map[status] ?? null;
}

/**
 * Compute KYC status from multiple sources (prefer live link status)
 */
export function computeKycStatus(
  kycLinkStatus: string | undefined,
  initialKycStatus: KycStatus | undefined,
): KycStatus {
  if (kycLinkStatus) {
    return (kycLinkStatus as KycStatus) || KycStatus.UNDER_REVIEW;
  }
  if (initialKycStatus) {
    return initialKycStatus;
  }
  return KycStatus.NOT_STARTED;
}

/**
 * Compute UI KYC status with processing window override
 */
export function computeUiKycStatus(
  processingUntil: number | null,
  liveStatus: KycStatus | undefined,
  kycStatus: KycStatus,
): KycStatus {
  const now = Date.now();
  const activeWindow =
    Boolean(processingUntil && now < processingUntil) && !isFinalKycStatus(liveStatus);
  return activeWindow ? KycStatus.UNDER_REVIEW : kycStatus;
}

/**
 * Format rejection reasons for display
 */
export function formatRejectionReasons(
  kycLink: KycLinkFromBridgeResponse | undefined,
): string | undefined {
  const reasons = (kycLink as any)?.rejection_reasons;
  if (!reasons || !Array.isArray(reasons) || reasons.length === 0) return undefined;

  try {
    const items = reasons
      .map((r: any) => (typeof r === 'string' ? r : r?.reason))
      .filter((r: any) => typeof r === 'string' && r.trim().length > 0);
    if (!items.length) return undefined;
    return `We couldn't verify your identity:\n- ${items.join('\n- ')}`;
  } catch {
    return undefined;
  }
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
  kycLink: KycLinkFromBridgeResponse | undefined,
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
  }, [initialKycStatus, kycStatus, processingUntil, setProcessingUntil, kycLink]);

  // Clear processing window on final status
  useEffect(() => {
    if (isFinalKycStatus(kycStatus) && processingUntil) {
      clearProcessingUntil();
    }
  }, [kycStatus, processingUntil, clearProcessingUntil]);
}
