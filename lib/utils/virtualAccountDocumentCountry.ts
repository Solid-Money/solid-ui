import { CardStatusResponse, KycStatus } from '@/lib/types';
import { getVirtualAccountRainStatus } from '@/lib/utils/virtualAccountRainStatus';

/** Rain-row KYC states that mean an identity document already passed Didit. */
const DOCUMENT_ALREADY_VERIFIED: readonly string[] = [
  KycStatus.UNDER_REVIEW,
  KycStatus.INCOMPLETE,
  KycStatus.APPROVED,
];

/**
 * Whether to ask which country issued the user's ID before the setup fee.
 *
 * The virtual account is gated by Rain on the ID document, not on residence:
 * Didit's virtual-account workflow refuses documents from Rain's restricted
 * countries, so a Russian passport holder living in Georgia passed every
 * residence check, paid $10, and then found no way to pick their document. The
 * question is asked before money moves so that answer can stop them first.
 *
 * Not asked once a document has already been through verification — a Rain
 * consumer exists, Rain has a status, or Didit approved the Rain row — since
 * there is nothing left for the answer to prevent.
 */
export const needsDocumentCountryCheck = (
  cardStatus: CardStatusResponse | null | undefined,
): boolean => {
  if (cardStatus?.rainKycApplicationEstablished) return false;
  if (getVirtualAccountRainStatus(cardStatus)) return false;

  const rainKycStatus = cardStatus?.rainApplication?.kycStatus;
  return !(rainKycStatus && DOCUMENT_ALREADY_VERIFIED.includes(rainKycStatus));
};
