import { useCallback, useState } from 'react';
import { Pressable, PressableProps, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import AddressBook from '@/components/Send/AddressBook';
import { CashoutAmount } from '@/components/Send/Cashout/CashoutAmount';
import { CashoutCurrencySelector } from '@/components/Send/Cashout/CashoutCurrencySelector';
import { CashoutDetailsForm } from '@/components/Send/Cashout/CashoutDetailsForm';
import { CashoutKycStep } from '@/components/Send/Cashout/CashoutKycStep';
import { CashoutMethodSelector } from '@/components/Send/Cashout/CashoutMethodSelector';
import { CashoutReview } from '@/components/Send/Cashout/CashoutReview';
import { CashoutStatus } from '@/components/Send/Cashout/CashoutStatus';
import SendForm from '@/components/Send/SendForm';
import SendQRScanner from '@/components/Send/SendQRScanner';
import SendReview from '@/components/Send/SendReview';
import SendSearch from '@/components/Send/SendSearch';
import TokenSelector from '@/components/Send/TokenSelector';
import TransactionStatus from '@/components/TransactionStatus';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useTransfiCashoutPaymentMethods } from '@/hooks/useTransfiCashout';
import { getBuyCryptoTitle } from '@/lib/buyCryptoFlow';
import getTokenIcon from '@/lib/getTokenIcon';
import { SendModal } from '@/lib/types';
import { hasUnsavedCashoutData, useCashoutStore } from '@/store/useCashoutStore';
import { hasUnsavedSendData, useSendStore } from '@/store/useSendStore';

import useResponsiveModal from './useResponsiveModal';

export interface SendOptionProps {
  buttonText?: string;
  trigger?: React.ReactNode;
  modal?: SendModal;
}

const useSendOption = ({
  buttonText = 'Send',
  trigger,
  modal = SEND_MODAL.OPEN_SEND_SEARCH,
}: SendOptionProps = {}) => {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Use useShallow for object selection to prevent unnecessary re-renders
  const { currentModal, previousModal, transaction, selectedToken, setModal, resetAll } =
    useSendStore(
      useShallow(state => ({
        currentModal: state.currentModal ?? SEND_MODAL.CLOSE,
        previousModal: state.previousModal ?? SEND_MODAL.CLOSE,
        transaction: state.transaction,
        selectedToken: state.selectedToken,
        setModal: state.setModal,
        resetAll: state.resetAll,
      })),
    );
  const router = useRouter();
  const { triggerElement } = useResponsiveModal();

  const isSearch = currentModal.name === SEND_MODAL.OPEN_SEND_SEARCH.name;
  const isForm = currentModal.name === SEND_MODAL.OPEN_FORM.name;
  const isTokenSelector = currentModal.name === SEND_MODAL.OPEN_TOKEN_SELECTOR.name;
  const isReview = currentModal.name === SEND_MODAL.OPEN_REVIEW.name;
  const isTransactionStatus = currentModal.name === SEND_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isAddressBook = currentModal.name === SEND_MODAL.OPEN_ADDRESS_BOOK.name;
  const isQRScanner = currentModal.name === SEND_MODAL.OPEN_QR_SCANNER.name;
  const isClose = currentModal.name === SEND_MODAL.CLOSE.name;
  const isCashoutKyc = currentModal.name === SEND_MODAL.OPEN_CASHOUT_KYC.name;
  const isCashoutCurrency = currentModal.name === SEND_MODAL.OPEN_CASHOUT_CURRENCY.name;
  const isCashoutMethod = currentModal.name === SEND_MODAL.OPEN_CASHOUT_METHOD.name;
  const isCashoutDetails = currentModal.name === SEND_MODAL.OPEN_CASHOUT_DETAILS.name;
  const isCashoutAmount = currentModal.name === SEND_MODAL.OPEN_CASHOUT_AMOUNT.name;
  const isCashoutReview = currentModal.name === SEND_MODAL.OPEN_CASHOUT_REVIEW.name;
  const isCashoutStatus = currentModal.name === SEND_MODAL.OPEN_CASHOUT_STATUS.name;
  const isCashout =
    isCashoutKyc ||
    isCashoutCurrency ||
    isCashoutMethod ||
    isCashoutDetails ||
    isCashoutAmount ||
    isCashoutReview ||
    isCashoutStatus;

  const resetCashout = useCashoutStore(state => state.reset);
  const cashoutKycModal = useCashoutStore(state => state.kycModal);
  const cashoutCurrency = useCashoutStore(state => state.currency);
  const cashoutPaymentCode = useCashoutStore(state => state.paymentCode);
  const { data: cashoutMethods } = useTransfiCashoutPaymentMethods(
    isCashoutDetails ? cashoutCurrency : undefined,
  );
  const cashoutMethodName = cashoutMethods?.find(
    method => method.paymentCode === cashoutPaymentCode,
  )?.paymentName;

  // The drawer's reset also clears a cash-out in progress: the two flows share
  // the drawer, and a half-typed IBAN must not greet the next send.
  const resetDrawer = useCallback(() => {
    resetAll();
    resetCashout();
  }, [resetAll, resetCashout]);
  const shouldAnimate = previousModal.name !== SEND_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const handleTransactionStatusPress = useCallback(() => {
    const trackingId = useSendStore.getState().transaction.trackingId;
    if (trackingId && isTransactionStatus) {
      router.navigate(`/activity/${trackingId}`, { dangerouslySingular: true });
    } else {
      router.push(path.ACTIVITY);
    }
    setModal(SEND_MODAL.CLOSE);
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
            <Text className="text-base font-bold text-primary-foreground">{buttonText}</Text>
          </View>
        </Trigger>
      );
    },
    [trigger, buttonText],
  );

  const getContent = () => {
    if (isCashoutKyc) return <CashoutKycStep />;
    if (isCashoutCurrency) return <CashoutCurrencySelector />;
    if (isCashoutMethod) return <CashoutMethodSelector />;
    if (isCashoutDetails) return <CashoutDetailsForm />;
    if (isCashoutAmount) return <CashoutAmount />;
    if (isCashoutReview) return <CashoutReview />;
    if (isCashoutStatus) return <CashoutStatus />;

    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          address={transaction.address}
          onPress={handleTransactionStatusPress}
          icon={getTokenIcon({
            logoUrl: selectedToken?.logoUrl,
            tokenSymbol: selectedToken?.contractTickerSymbol,
          })}
          token={selectedToken?.contractTickerSymbol || 'TOKEN'}
        />
      );
    }

    if (isReview) {
      return <SendReview />;
    }

    if (isTokenSelector) {
      return <TokenSelector />;
    }

    if (isForm) {
      return <SendForm onNext={() => setModal(SEND_MODAL.OPEN_REVIEW)} />;
    }

    if (isAddressBook) {
      return <AddressBook />;
    }

    if (isQRScanner) {
      return <SendQRScanner />;
    }

    return <SendSearch />;
  };

  const getContentKey = () => {
    if (isCashoutKyc) return `cashout-kyc-${cashoutKycModal?.name ?? 'pending'}`;
    if (isCashoutCurrency) return 'cashout-currency';
    if (isCashoutMethod) return 'cashout-method';
    if (isCashoutDetails) return 'cashout-details';
    if (isCashoutAmount) return 'cashout-amount';
    if (isCashoutReview) return 'cashout-review';
    if (isCashoutStatus) return 'cashout-status';
    if (isTransactionStatus) return 'transaction-status';
    if (isReview) return 'review';
    if (isTokenSelector) return 'token-selector';
    if (isForm) return 'form';
    if (isAddressBook) return 'address-book';
    if (isQRScanner) return 'qr-scanner';
    return 'send-search';
  };

  const getTitle = () => {
    if (isCashoutKyc) {
      return cashoutKycModal ? (getBuyCryptoTitle(cashoutKycModal) ?? 'Cash out') : 'Verifying';
    }
    if (isCashoutCurrency || isCashoutMethod) return 'Cash out';
    if (isCashoutDetails) return cashoutMethodName ?? 'Account details';
    if (isCashoutAmount) return 'Amount';
    if (isCashoutReview) return 'Review';
    if (isCashoutStatus) return undefined;
    if (isTransactionStatus) return undefined;
    if (isReview) return 'Review';
    if (isTokenSelector) return 'Select token';
    if (isForm) return 'Send';
    if (isAddressBook) return 'Contacts';
    if (isQRScanner) return undefined; // Fullscreen camera, no title needed
    return 'Send';
  };

  const getContentClassName = () => {
    // Fullscreen camera view: remove padding, margins, and size constraints
    if (isQRScanner) return '!p-0 !mt-0 !min-h-screen !max-w-none !rounded-none';
    return '';
  };

  const getContainerClassName = () => {
    if (isQRScanner) return 'flex-1'; // Fill available space for camera view
    if (isSearch) return 'min-h-[40rem]';
    if (isReview) return 'min-h-[30rem]';
    if (isCashout) return 'min-h-[30rem]';
    return '';
  };

  const getDisableScroll = () => {
    // Camera view needs to escape ScrollView constraints
    return isQRScanner;
  };

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (value) {
        setModal(modal);
      } else {
        const currentModalName = useSendStore.getState().currentModal.name;
        // Skip discard prompt if transaction has already been initiated
        if (
          currentModalName === SEND_MODAL.OPEN_TRANSACTION_STATUS.name ||
          currentModalName === SEND_MODAL.OPEN_CASHOUT_STATUS.name
        ) {
          resetDrawer();
        } else if (hasUnsavedSendData() || hasUnsavedCashoutData()) {
          setShowDiscardDialog(true);
        } else {
          resetDrawer();
        }
      }
    },
    [modal, setModal, resetDrawer],
  );

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardDialog(false);
    resetDrawer();
  }, [resetDrawer]);

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardDialog(false);
  }, []);

  const handleBackPress = () => {
    if (isCashoutKyc || isCashoutCurrency) {
      setModal(SEND_MODAL.OPEN_SEND_SEARCH);
      return;
    }
    if (isCashoutMethod) return setModal(SEND_MODAL.OPEN_CASHOUT_CURRENCY);
    if (isCashoutDetails) return setModal(SEND_MODAL.OPEN_CASHOUT_METHOD);
    if (isCashoutAmount) return setModal(SEND_MODAL.OPEN_CASHOUT_DETAILS);
    if (isCashoutReview) return setModal(SEND_MODAL.OPEN_CASHOUT_AMOUNT);

    if (isReview) {
      setModal(SEND_MODAL.OPEN_FORM);
    } else if (isTokenSelector) {
      setModal(SEND_MODAL.OPEN_FORM);
    } else if (isForm) {
      setModal(SEND_MODAL.OPEN_SEND_SEARCH);
    } else if (isAddressBook) {
      setModal(SEND_MODAL.OPEN_SEND_SEARCH);
    } else if (isQRScanner) {
      setModal(SEND_MODAL.OPEN_SEND_SEARCH);
    } else {
      setModal(SEND_MODAL.CLOSE);
    }
  };

  const shouldOpen = !isClose;

  // QR scanner has its own header with close button, so don't show modal back button
  const showBackButton =
    isForm || isTokenSelector || isReview || isAddressBook || (isCashout && !isCashoutStatus);

  return {
    shouldOpen,
    showBackButton,
    shouldAnimate,
    isForward,
    getTrigger,
    getContent,
    getContentKey,
    getTitle,
    getContentClassName,
    getContainerClassName,
    getDisableScroll,
    handleOpenChange,
    handleBackPress,
    showDiscardDialog,
    handleDiscardConfirm,
    handleDiscardCancel,
  };
};

export default useSendOption;
