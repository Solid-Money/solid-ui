import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react';

import { BankTransferModalContent } from '@/components/BankTransfer/BankTransferModalContent';
import { KycModalContent } from '@/components/BankTransfer/KycModalContent';
import BuyCrypto from '@/components/BuyCrypto';
import DepositEmailModal from '@/components/DepositEmailModal';
import DepositNetworks from '@/components/DepositNetwork/DepositNetworks';
import { DepositToVaultForm } from '@/components/DepositToVault';
import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import getTokenIcon from '@/lib/getTokenIcon';
import { useDepositStore } from '@/store/useDepositStore';
import DepositBuyCryptoOptions from './DepositBuyCryptoOptions';
import DepositOptions from './DepositOptions';
import DepositPublicAddress from './DepositPublicAddress';

interface ResponsiveDepositOptionModalProps {
  buttonText?: string;
  trigger?: React.ReactNode;
}

const ResponsiveDepositOptionModal = ({
  buttonText = 'Add funds',
  trigger,
}: ResponsiveDepositOptionModalProps) => {
  const { user } = useUser();
  const { currentModal, previousModal, transaction, setModal, srcChainId } = useDepositStore();
  const activeAccount = useActiveAccount();
  const status = useActiveWalletConnectionStatus();
  const address = activeAccount?.address;
  const router = useRouter();

  const isForm = currentModal.name === DEPOSIT_MODAL.OPEN_FORM.name;
  const isFormAndAddress = Boolean(isForm && address);
  const isBuyCrypto = currentModal.name === DEPOSIT_MODAL.OPEN_BUY_CRYPTO.name;
  const isBuyCryptoOptions = currentModal.name === DEPOSIT_MODAL.OPEN_BUY_CRYPTO_OPTIONS.name;
  const isPublicAddress = currentModal.name === DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS.name;
  const isTransactionStatus = currentModal.name === DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isNetworks = currentModal.name === DEPOSIT_MODAL.OPEN_NETWORKS.name;
  const isEmailGate = currentModal.name === DEPOSIT_MODAL.OPEN_EMAIL_GATE.name;
  const isBankTransferAmount = currentModal.name === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT.name;
  const isBankTransferPayment = currentModal.name === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PAYMENT.name;
  const isBankTransferPreview = currentModal.name === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PREVIEW.name;
  const isBankTransferKycInfo =
    currentModal.name === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_KYC_INFO.name;
  const isBankTransferKycFrame =
    currentModal.name === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_KYC_FRAME.name;
  const isBankTransferKyc = isBankTransferKycInfo || isBankTransferKycFrame;
  const isBankTransfer =
    isBankTransferAmount || isBankTransferPayment || isBankTransferPreview || isBankTransferKyc;
  const isClose = currentModal.name === DEPOSIT_MODAL.CLOSE.name;
  const shouldAnimate = previousModal.name !== DEPOSIT_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const handleTransactionStatusPress = useCallback(() => {
    const { transaction } = useDepositStore.getState();
    if (transaction.trackingId) {
      router.push(`/activity/${transaction.trackingId}`);
    } else {
      router.push(path.ACTIVITY);
    }
    setModal(DEPOSIT_MODAL.CLOSE);
  }, [router, setModal]);

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'brand',
          className: 'h-12 pr-6 rounded-xl',
        })}
      >
        <View className="flex-row items-center gap-4">
          <Plus color="black" />
          <Text className="text-primary-foreground font-bold">{buttonText}</Text>
        </View>
      </View>
    );
  };

  const getContent = () => {
    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          onPress={handleTransactionStatusPress}
          icon={getTokenIcon({ tokenSymbol: 'USDC' })}
        />
      );
    }

    if (isEmailGate) {
      return <DepositEmailModal />;
    }

    if (isFormAndAddress) {
      return <DepositToVaultForm />;
    }

    if (isBuyCrypto) {
      return <BuyCrypto />;
    }

    if (isBuyCryptoOptions) {
      return <DepositBuyCryptoOptions />;
    }

    if (isPublicAddress) {
      return <DepositPublicAddress />;
    }

    if (isNetworks) {
      return <DepositNetworks />;
    }

    if (isBankTransferKyc) {
      return <KycModalContent />;
    }

    if (isBankTransfer) {
      return <BankTransferModalContent />;
    }

    return <DepositOptions />;
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    if (isEmailGate) return 'email-gate';
    if (isFormAndAddress) return 'deposit-form';
    if (isBuyCrypto) return 'buy-crypto';
    if (isBuyCryptoOptions) return 'buy-crypto-options';
    if (isPublicAddress) return 'public-address';
    if (isNetworks) return 'networks';
    if (isBankTransferKycInfo) return 'bank-transfer-kyc-info';
    if (isBankTransferKycFrame) return 'bank-transfer-kyc-frame';
    if (isBankTransferAmount) return 'bank-transfer-amount';
    if (isBankTransferPayment) return 'bank-transfer-payment';
    if (isBankTransferPreview) return 'bank-transfer-preview';
    return 'deposit-options';
  };

  const getTitle = () => {
    if (isTransactionStatus || isEmailGate) return undefined;
    if (isBankTransferKycInfo) return 'Identity Verification';
    if (isBankTransferKycFrame) return 'Identity Verification';
    if (isBankTransferAmount) return 'Amount to buy';
    if (isBankTransferPayment) return 'Choose payment method';
    if (isBankTransferPreview) return 'Transfer Details';
    return 'Deposit';
  };

  const getContentClassName = () => {
    if (isBuyCrypto) {
      return 'w-[470px] h-[80vh] md:h-[85vh]';
    }
    if (isBankTransferKycFrame) {
      return 'w-[800px] h-[85vh] max-w-[95vw]';
    }
    if (isBankTransfer) {
      return 'w-[450px] max-h-[85vh]';
    }
    if (isEmailGate) {
      return 'pb-4 md:pb-4';
    }
    return '';
  };

  const getContainerClassName = () => {
    if (
      !isFormAndAddress &&
      !isBuyCrypto &&
      !isTransactionStatus &&
      !isEmailGate &&
      !isNetworks &&
      !isBankTransfer
    ) {
      return 'min-h-[40rem]';
    }
    return '';
  };

  const handleOpenChange = (value: boolean) => {
    // Prevent closing when Reown modal is open
    if (!address && isForm) {
      return;
    }

    if (value) {
      // Check if user has email when opening deposit modal
      if (user && !user.email) {
        setModal(DEPOSIT_MODAL.OPEN_EMAIL_GATE);
      } else if (address) {
        if (srcChainId) {
          setModal(DEPOSIT_MODAL.OPEN_FORM);
        } else {
          setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
        }
      } else {
        setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
      }
    } else {
      setModal(DEPOSIT_MODAL.CLOSE);
    }
  };

  const handleBackPress = () => {
    if (isFormAndAddress) {
      setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
    } else if (isBankTransferKycFrame) {
      setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_KYC_INFO);
    } else if (isBankTransferKycInfo) {
      setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PAYMENT);
    } else if (isBankTransferAmount) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    } else if (isBankTransferPayment) {
      setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT);
    } else if (isBankTransferPreview) {
      setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PAYMENT);
    } else if (isBuyCryptoOptions) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    } else if (isPublicAddress) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    } else {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    }
  };

  useEffect(() => {
    if (status === 'disconnected' && !isClose) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    }
  }, [status, setModal, isClose]);

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={trigger ?? getTrigger()}
      title={getTitle()}
      contentClassName={getContentClassName()}
      containerClassName={getContainerClassName()}
      showBackButton={
        isFormAndAddress ||
        isBuyCrypto ||
        isBuyCryptoOptions ||
        isPublicAddress ||
        isNetworks ||
        isBankTransferAmount ||
        isBankTransferPayment ||
        isBankTransferPreview ||
        isBankTransferKycInfo ||
        isBankTransferKycFrame
      }
      onBackPress={handleBackPress}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
      contentKey={getContentKey()}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default ResponsiveDepositOptionModal;
