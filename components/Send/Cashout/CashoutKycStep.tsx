import { BuyCryptoFlowContent } from '@/components/BuyCrypto/Transfi/BuyCryptoFlow';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useCashoutKycNavigate } from '@/hooks/useCashout';
import { useCashoutStore } from '@/store/useCashoutStore';

/**
 * TransFi's KYC screens — consent, pending, profile, error — inside the Send
 * drawer. The same screens buy crypto uses, so a user verifies once for both;
 * only the navigator and the return route after an identity check differ.
 */
export const CashoutKycStep = () => {
  const navigate = useCashoutKycNavigate();
  const kycModal = useCashoutStore(state => state.kycModal);

  return (
    <BuyCryptoFlowContent
      modal={kycModal ?? DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING}
      navigate={navigate}
      kycFlow="transfi_cashout"
    />
  );
};

export default CashoutKycStep;
