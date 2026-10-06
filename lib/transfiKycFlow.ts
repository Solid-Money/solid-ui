import { DEPOSIT_MODAL, SEND_MODAL } from '@/constants/modals';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useSendStore } from '@/store/useSendStore';

import type { KycFlow } from '@/store/useKycStore';

/**
 * Whether an identity check was started for TransFi — to buy crypto or to
 * cash out. Both verify the same way (an onramp session, shared with TransFi
 * afterwards); they only return the user to different drawers.
 */
export const isTransfiKycFlow = (flow: KycFlow | null | undefined): boolean =>
  flow === 'transfi' || flow === 'transfi_cashout';

/**
 * Re-open the drawer the TransFi check started from, at the KYC pending step —
 * which shares the fresh verification with TransFi and polls until it is
 * approved. Called just before returning to the home screen, where both
 * drawers are mounted.
 */
export const resumeTransfiKycFlow = (flow: KycFlow | null | undefined) => {
  if (flow === 'transfi_cashout') {
    useCashoutStore.getState().setKycModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
    useSendStore.getState().setModal(SEND_MODAL.OPEN_CASHOUT_KYC);
    return;
  }
  if (flow === 'transfi') {
    useDepositStore.getState().setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
  }
};
