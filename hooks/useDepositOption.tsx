import { useRouter } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, PressableProps, View } from 'react-native';
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react';

import { BankTransferModalContent } from '@/components/BankTransfer/BankTransferModalContent';
import { KycModalContent } from '@/components/BankTransfer/KycModalContent';
import BuyCrypto from '@/components/BuyCrypto';
import DepositEmailModal from '@/components/DepositEmailModal';
import DepositNetworks from '@/components/DepositNetwork/DepositNetworks';
import DepositBuyCryptoOptions from '@/components/DepositOption/DepositBuyCryptoOptions';
import DepositDirectlyAddress from '@/components/DepositOption/DepositDirectlyAddress';
import DepositDirectlyNetworks from '@/components/DepositOption/DepositDirectlyNetworks';
import DepositDirectlyTokens from '@/components/DepositOption/DepositDirectlyTokens';
import DepositExternalWalletOptions from '@/components/DepositOption/DepositExternalWalletOptions';
import DepositOptions from '@/components/DepositOption/DepositOptions';
import DepositPublicAddress from '@/components/DepositOption/DepositPublicAddress';
import { DepositTokenSelector, DepositToVaultForm } from '@/components/DepositToVault';
import TransactionStatus from '@/components/TransactionStatus';
import { Button, buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useDirectDepositSession } from '@/hooks/useDirectDepositSession';
import useUser from '@/hooks/useUser';
import getTokenIcon from '@/lib/getTokenIcon';
import { DepositModal } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import useResponsiveModal from './useResponsiveModal';

export interface DepositOptionProps {
  buttonText?: string;
  trigger?: React.ReactNode;
  modal?: DepositModal;
}

const useDepositOption = ({
  buttonText = 'Add funds',
  trigger,
  modal = DEPOSIT_MODAL.OPEN_OPTIONS,
}: DepositOptionProps = {}) => {
  const { user } = useUser();
  const {
    currentModal,
    previousModal,
    transaction,
    setModal,
    srcChainId,
    outputToken,
    bankTransfer,
    directDepositSession,
  } = useDepositStore();
  const activeAccount = useActiveAccount();
  const status = useActiveWalletConnectionStatus();
  const address = activeAccount?.address;
  const router = useRouter();
  const { deleteDirectDepositSession } = useDirectDepositSession();
  const [isDeleting, setIsDeleting] = useState(false);
  const { triggerElement } = useResponsiveModal();

  const isForm = currentModal.name === DEPOSIT_MODAL.OPEN_FORM.name;
  const isFormAndAddress = Boolean(isForm && address);
  const isBuyCrypto = currentModal.name === DEPOSIT_MODAL.OPEN_BUY_CRYPTO.name;
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
  const isExternalWalletOptions =
    currentModal.name === DEPOSIT_MODAL.OPEN_EXTERNAL_WALLET_OPTIONS.name;
  const isBuyCryptoOptions = currentModal.name === DEPOSIT_MODAL.OPEN_BUY_CRYPTO_OPTIONS.name;
  const isPublicAddress = currentModal.name === DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS.name;
  const isDepositDirectly = currentModal.name === DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY.name;
  const isDepositDirectlyAddress =
    currentModal.name === DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS.name;
  const isDepositDirectlyTokens =
    currentModal.name === DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_TOKENS.name;
  const isTokenSelector = currentModal.name === DEPOSIT_MODAL.OPEN_TOKEN_SELECTOR.name;
  const isClose = currentModal.name === DEPOSIT_MODAL.CLOSE.name;
  const shouldAnimate = previousModal.name !== DEPOSIT_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const handleTransactionStatusPress = useCallback(() => {
    const trackingId = useDepositStore.getState().transaction.trackingId;
    if (trackingId && isTransactionStatus) {
      router.navigate(`/activity/${trackingId}`, { dangerouslySingular: true });
    } else {
      router.push(path.ACTIVITY);
    }
    setModal(DEPOSIT_MODAL.CLOSE);
  }, [router, setModal, isTransactionStatus]);

  const Trigger = ({ children, ...props }: PressableProps & { children?: React.ReactNode }) => {
    return (
      <Pressable
        {...props}
        className="flex-1"
        onPress={e => {
          if (props?.onPress) {
            props.onPress(e);
          } else {
            handleOpenChange(true);
          }
        }}
      >
        {triggerElement(children)}
      </Pressable>
    );
  };

  const getTrigger = useCallback(
    (props?: PressableProps) => {
      if (trigger) {
        return <Trigger {...props}>{trigger}</Trigger>;
      }

      return (
        <Trigger {...props}>
          <View
            className={buttonVariants({
              variant: 'brand',
              className: 'h-12 pr-6 rounded-xl',
            })}
          >
            <View className="flex-row items-center gap-1">
              <Plus color="black" />
              <Text className="text-primary-foreground font-bold text-base">{buttonText}</Text>
            </View>
          </View>
        </Trigger>
      );
    },
    [trigger, buttonText],
  );

  const getContent = () => {
    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          onPress={handleTransactionStatusPress}
          icon={getTokenIcon({ tokenSymbol: outputToken })}
          token={outputToken}
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

    if (isBankTransferKyc) {
      return <KycModalContent />;
    }

    if (isBankTransfer) {
      return <BankTransferModalContent />;
    }

    if (isExternalWalletOptions) {
      return <DepositExternalWalletOptions />;
    }

    if (isBuyCryptoOptions) {
      return <DepositBuyCryptoOptions />;
    }

    if (isPublicAddress) {
      return <DepositPublicAddress />;
    }

    if (isDepositDirectly) {
      return <DepositDirectlyNetworks />;
    }

    if (isDepositDirectlyAddress) {
      return <DepositDirectlyAddress />;
    }

    if (isDepositDirectlyTokens) {
      return <DepositDirectlyTokens />;
    }

    if (isTokenSelector) {
      return <DepositTokenSelector />;
    }

    return <DepositOptions />;
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    if (isEmailGate) return 'email-gate';
    if (isFormAndAddress) return 'deposit-form';
    if (isBuyCrypto) return 'buy-crypto';
    if (isNetworks) return 'networks';
    if (isBankTransferKycInfo) return 'bank-transfer-kyc-info';
    if (isBankTransferKycFrame) return 'bank-transfer-kyc-frame';
    if (isBankTransferAmount) return 'bank-transfer-amount';
    if (isBankTransferPayment) return 'bank-transfer-payment';
    if (isBankTransferPreview) return 'bank-transfer-preview';
    if (isExternalWalletOptions) return 'external-wallet-options';
    if (isBuyCryptoOptions) return 'buy-crypto-options';
    if (isPublicAddress) return 'public-address';
    if (isDepositDirectly) return 'deposit-directly-networks';
    if (isDepositDirectlyAddress) return 'deposit-directly-address';
    if (isDepositDirectlyTokens) return 'deposit-directly-tokens';
    if (isTokenSelector) return 'token-selector';
    return 'deposit-options';
  };

  const getTitle = () => {
    if (isTransactionStatus || isEmailGate || isDepositDirectlyAddress) return undefined;
    if (isBankTransferKycInfo) return 'Identity Verification';
    if (isBankTransferKycFrame) return 'Identity Verification';
    if (isBankTransferAmount) return 'Amount to buy';
    if (isBankTransferPayment) return 'Choose payment method';
    if (isBankTransferPreview) return 'Transfer Details';
    if (isExternalWalletOptions) return 'Deposit from external wallet';
    if (isBuyCryptoOptions) return 'Buy crypto';
    if (isPublicAddress) return 'Solid address';
    if (isDepositDirectly) return 'Choose network';
    if (isDepositDirectlyTokens) return 'Choose token';
    if (isTokenSelector) return 'Select a token';
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
    if (isDepositDirectlyAddress) {
      return 'w-[450px] max-h-[95vh] md:pb-4';
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
      !isBankTransfer &&
      !isDepositDirectly
    ) {
      return 'min-h-[40rem]';
    }

    return '';
  };

  const handleOpenChange = (value: boolean) => {
    if (!value && isFormAndAddress && status === 'connecting') {
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
        setModal(modal);
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
    } else if (isExternalWalletOptions) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    } else if (isBuyCryptoOptions) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    } else if (isPublicAddress) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    } else if (isDepositDirectly) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    } else if (isDepositDirectlyAddress) {
      // Go back to token selection if multiple tokens available, otherwise to network selection
      const { directDepositSession } = useDepositStore.getState();
      const chainId = directDepositSession.chainId;
      const network = chainId ? BRIDGE_TOKENS[chainId] : null;
      const hasMultipleTokens = network?.tokens?.USDC && network?.tokens?.USDT;

      if (hasMultipleTokens) {
        setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_TOKENS);
      } else {
        setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY);
      }
    } else if (isDepositDirectlyTokens) {
      setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY);
    } else if (isTokenSelector) {
      setModal(DEPOSIT_MODAL.OPEN_FORM);
    } else if (isBuyCrypto) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    } else if (isNetworks) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    } else {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    }
  };

  const handleDeleteDeposit = useCallback(async () => {
    const { directDepositSession } = useDepositStore.getState();
    let {clientTxId, sessionId} = directDepositSession;
    if (!clientTxId) {
      if (!sessionId) return;
      clientTxId = `direct_deposit_${sessionId}`;
    }

    try {
      setIsDeleting(true);
      await deleteDirectDepositSession(clientTxId);
      setModal(DEPOSIT_MODAL.CLOSE);
    } catch (error) {
      console.error('Failed to delete deposit session:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [directDepositSession.sessionId, deleteDirectDepositSession, setModal]);

  const actionButton = useMemo(() => {
    if (
      isDepositDirectlyAddress &&
      (directDepositSession.status === 'pending' || !directDepositSession.status)
    ) {
      return (
        <Button
          variant="ghost"
          className="rounded-full p-0 web:hover:bg-transparent web:hover:opacity-70"
          onPress={handleDeleteDeposit}
          disabled={isDeleting}
        >
          {isDeleting ? <ActivityIndicator size="small" color="white" /> : (
            <Trash2 size={20} color="white" />
          )}
        </Button>
      );
    }
    return undefined;
  }, [isDepositDirectlyAddress, directDepositSession.status, handleDeleteDeposit, isDeleting]);

  useEffect(() => {
    if (
      status === 'disconnected' &&
      !isClose &&
      !isDepositDirectly &&
      !isDepositDirectlyAddress &&
      !isDepositDirectlyTokens &&
      !isExternalWalletOptions &&
      !isBuyCryptoOptions
    ) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    }
  }, [
    status,
    setModal,
    isClose,
    isDepositDirectly,
    isDepositDirectlyAddress,
    isDepositDirectlyTokens,
    isExternalWalletOptions,
    isBuyCryptoOptions,
    currentModal.name,
  ]);

  // Open the modal for all states except when explicitly closed
  const shouldOpen = !isClose;

  const showBackButton =
    isFormAndAddress ||
    isBuyCrypto ||
    isNetworks ||
    isBankTransferAmount ||
    isBankTransferPayment ||
    (isBankTransferPreview && !bankTransfer.fromActivity) ||
    isBankTransferKycInfo ||
    isBankTransferKycFrame ||
    isExternalWalletOptions ||
    isBuyCryptoOptions ||
    isPublicAddress ||
    isDepositDirectly ||
    isDepositDirectlyAddress ||
    isDepositDirectlyTokens ||
    isTokenSelector;

  return {
    shouldOpen,
    showBackButton,
    actionButton,
    shouldAnimate,
    isForward,
    getTrigger,
    getContent,
    getContentKey,
    getTitle,
    getContentClassName,
    getContainerClassName,
    handleOpenChange,
    handleBackPress,
  };
};

export default useDepositOption;
