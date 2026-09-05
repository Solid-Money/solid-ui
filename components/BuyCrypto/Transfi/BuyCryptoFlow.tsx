import { BuyCryptoNavigationProvider } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import { TransfiAmount } from '@/components/BuyCrypto/Transfi/TransfiAmount';
import { TransfiCurrencySelector } from '@/components/BuyCrypto/Transfi/TransfiCurrencySelector';
import { TransfiError } from '@/components/BuyCrypto/Transfi/TransfiError';
import { TransfiKycConsent } from '@/components/BuyCrypto/Transfi/TransfiKycConsent';
import { TransfiKycPending } from '@/components/BuyCrypto/Transfi/TransfiKycPending';
import { TransfiOrderStatus } from '@/components/BuyCrypto/Transfi/TransfiOrderStatus';
import { TransfiPayment } from '@/components/BuyCrypto/Transfi/TransfiPayment';
import { TransfiPaymentMethodSelector } from '@/components/BuyCrypto/Transfi/TransfiPaymentMethodSelector';
import { TransfiProfileForm } from '@/components/BuyCrypto/Transfi/TransfiProfileForm';
import { DEPOSIT_MODAL } from '@/constants/modals';

import type { BuyCryptoNavigate } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import type { DepositModal } from '@/lib/types';

export const BuyCryptoFlowContent = ({
  modal,
  navigate,
}: {
  modal: DepositModal;
  navigate: BuyCryptoNavigate;
}) => {
  const content = (() => {
    switch (modal.name) {
      case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_CONSENT.name:
        return <TransfiKycConsent />;
      case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING.name:
        return <TransfiKycPending />;
      case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT.name:
        return <TransfiAmount />;
      case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_CURRENCY.name:
        return <TransfiCurrencySelector />;
      case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT_METHOD.name:
        return <TransfiPaymentMethodSelector />;
      case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT.name:
        return <TransfiPayment />;
      case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_STATUS.name:
        return <TransfiOrderStatus />;
      case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PROFILE.name:
        return <TransfiProfileForm />;
      case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_ERROR.name:
        return <TransfiError />;
      default:
        return null;
    }
  })();

  return <BuyCryptoNavigationProvider navigate={navigate}>{content}</BuyCryptoNavigationProvider>;
};
