import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
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
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDirectDepositSession } from '@/hooks/useDirectDepositSession';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { DepositModal } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useShallow } from 'zustand/react/shallow';
import useResponsiveModal from './useResponsiveModal';

import Trash from '@/assets/images/trash';

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
    sessionStartTime,
    setSessionStartTime,
    clearSessionStartTime,
  } = useDepositStore(
    useShallow(state => ({
      currentModal: state.currentModal,
      previousModal: state.previousModal,
      transaction: state.transaction,
      setModal: state.setModal,
      srcChainId: state.srcChainId,
      outputToken: state.outputToken,
      bankTransfer: state.bankTransfer,
      directDepositSession: state.directDepositSession,
      sessionStartTime: state.sessionStartTime,
      setSessionStartTime: state.setSessionStartTime,
      clearSessionStartTime: state.clearSessionStartTime,
    })),
  );
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
              className: 'h-12 rounded-xl pr-6',
            })}
          >
            <View className="flex-row items-center gap-1">
              <Plus color="black" />
              <Text className="text-base font-bold text-primary-foreground">{buttonText}</Text>
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

  // Helper: Map modal to deposit method for analytics
  const getDepositMethodFromModal = (modal: DepositModal): string | null => {
    const modalName = modal?.name;
    if (!modalName) return null;

    // Wallet deposit method
    if (
      modalName === DEPOSIT_MODAL.OPEN_NETWORKS.name ||
      modalName === DEPOSIT_MODAL.OPEN_FORM.name ||
      modalName === DEPOSIT_MODAL.OPEN_TOKEN_SELECTOR.name
    ) {
      return 'wallet';
    }

    // Direct deposit method
    if (
      modalName === DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY.name ||
      modalName === DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_TOKENS.name ||
      modalName === DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS.name
    ) {
      return 'deposit_directly';
    }

    // Credit card method
    if (modalName === DEPOSIT_MODAL.OPEN_BUY_CRYPTO.name) {
      return 'credit_card';
    }

    // Bank transfer method
    if (
      modalName === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT.name ||
      modalName === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PAYMENT.name ||
      modalName === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PREVIEW.name ||
      modalName === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_KYC_INFO.name ||
      modalName === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_KYC_FRAME.name
    ) {
      return 'bank_transfer';
    }

    return null;
  };

  // Helper: Map modal to specific abandonment event
  const getAbandonmentEventFromModal = (modal: DepositModal): string => {
    const modalName = modal?.name;
    if (!modalName) return TRACKING_EVENTS.DEPOSIT_OPTIONS_ABANDONED;

    // Wallet method abandonment
    if (modalName === DEPOSIT_MODAL.OPEN_NETWORKS.name) {
      return TRACKING_EVENTS.DEPOSIT_WALLET_NETWORK_ABANDONED;
    }
    if (modalName === DEPOSIT_MODAL.OPEN_FORM.name) {
      return TRACKING_EVENTS.DEPOSIT_WALLET_FORM_ABANDONED;
    }

    // Bank transfer abandonment
    if (modalName === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT.name) {
      return TRACKING_EVENTS.DEPOSIT_BANK_AMOUNT_ABANDONED;
    }
    if (
      modalName === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PREVIEW.name ||
      modalName === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_KYC_INFO.name ||
      modalName === DEPOSIT_MODAL.OPEN_BANK_TRANSFER_KYC_FRAME.name
    ) {
      return TRACKING_EVENTS.DEPOSIT_BANK_INSTRUCTIONS_ABANDONED;
    }

    // Default to general abandonment
    return TRACKING_EVENTS.DEPOSIT_OPTIONS_ABANDONED;
  };

  const handleOpenChange = (value: boolean) => {
    if (!value && isFormAndAddress && status === 'connecting') {
      return;
    }

    if (value) {
      // Set session start time when modal opens (if not already set)
      if (!sessionStartTime) {
        setSessionStartTime(Date.now());
      }

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
      // Calculate time spent in deposit flow
      const timeSpent = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;

      // Get deposit method and appropriate abandonment event
      const depositMethod = getDepositMethodFromModal(currentModal);
      const abandonmentEvent = getAbandonmentEventFromModal(currentModal);

      // Track method-specific abandonment with enhanced properties
      track(abandonmentEvent, {
        last_step: currentModal.name,
        previous_step: previousModal.name,
        deposit_method: depositMethod,
        time_on_step: timeSpent,
        has_wallet_connected: !!address,
        has_selected_chain: !!srcChainId,
        is_first_deposit: !user?.isDeposited,
      });

      setModal(DEPOSIT_MODAL.CLOSE);
      clearSessionStartTime();
    }
  };

  const handleBackPress = () => {
    if (isFormAndAddress) {
      setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
    } else if (isBankTransferKycFrame) {
      const { kyc } = useDepositStore.getState();

      // New customers go: Payment Method → Info Form → KYC Frame
      // Existing customers skip info form: Payment Method → KYC Frame
      // Back navigation should respect which path the user took
      if (kyc.enteredViaInfoForm) {
        setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_KYC_INFO);
      } else {
        setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PAYMENT);
      }
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
    let { clientTxId, sessionId } = directDepositSession;
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
          size="icon"
          className="items-center justify-center rounded-full bg-popover p-0 web:transition-colors web:hover:bg-muted"
          onPress={handleDeleteDeposit}
          disabled={isDeleting}
        >
          {isDeleting ? <ActivityIndicator size="small" color="white" /> : <Trash />}
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
