import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react';

import AnimatedModal from '@/components/AnimatedModal';
import BuyCrypto from '@/components/BuyCrypto';
import DepositEmailModal from '@/components/DepositEmailModal';
import DepositNetworks from '@/components/DepositNetwork/DepositNetworks';
import { DepositToVaultForm } from '@/components/DepositToVault';
import TransactionStatus from '@/components/TransactionStatus';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import useUser from '@/hooks/useUser';
import getTokenIcon from '@/lib/getTokenIcon';
import { useDepositStore } from '@/store/useDepositStore';
import DepositOptions from './DepositOptions';
import { path } from '@/constants/path';

interface DepositOptionModalProps {
  buttonText?: string;
  trigger?: React.ReactNode;
}

const DepositOptionModal = ({ buttonText = 'Add funds', trigger }: DepositOptionModalProps) => {
  const { user } = useUser();
  const { currentModal, previousModal, transaction, setModal, srcChainId } = useDepositStore();
  const activeAccount = useActiveAccount();
  const status = useActiveWalletConnectionStatus();
  const address = activeAccount?.address;
  const router = useRouter();

  const isForm = currentModal.name === DEPOSIT_MODAL.OPEN_FORM.name;
  const isFormAndAddress = Boolean(isForm && address);
  const isBuyCrypto = currentModal.name === DEPOSIT_MODAL.OPEN_BUY_CRYPTO.name;
  const isTransactionStatus = currentModal.name === DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isNetworks = currentModal.name === DEPOSIT_MODAL.OPEN_NETWORKS.name;
  const isEmailGate = currentModal.name === DEPOSIT_MODAL.OPEN_EMAIL_GATE.name;
  const isClose = currentModal.name === DEPOSIT_MODAL.CLOSE.name;
  const shouldAnimate = previousModal.name !== DEPOSIT_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const handleTransactionStatusPress = () => {
    setModal(DEPOSIT_MODAL.CLOSE);
    router.push(path.SAVINGS);
  };

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

    if (isNetworks) {
      return <DepositNetworks />;
    }

    return <DepositOptions />;
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    if (isEmailGate) return 'email-gate';
    if (isFormAndAddress) return 'deposit-form';
    if (isBuyCrypto) return 'buy-crypto';
    if (isNetworks) return 'networks';
    return 'deposit-options';
  };

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    if (isEmailGate) return 'Email Required';
    return 'Deposit';
  };

  const getContentClassName = () => {
    if (isBuyCrypto) {
      return 'w-[470px] h-[80vh] md:h-[85vh]';
    }
    return '';
  };

  const getContainerClassName = () => {
    if (!isFormAndAddress && !isBuyCrypto && !isTransactionStatus && !isEmailGate && !isNetworks) {
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
    if (isEmailGate) {
      setModal(DEPOSIT_MODAL.CLOSE);
    } else if (isFormAndAddress) {
      setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
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
    <AnimatedModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={trigger ?? getTrigger()}
      title={getTitle()}
      contentClassName={getContentClassName()}
      containerClassName={getContainerClassName()}
      showBackButton={isFormAndAddress || isBuyCrypto || isEmailGate || isNetworks}
      onBackPress={handleBackPress}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
      contentKey={getContentKey()}
    >
      {getContent()}
    </AnimatedModal>
  );
};

export default DepositOptionModal;
