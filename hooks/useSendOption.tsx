import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, PressableProps, View } from 'react-native';

import AddressBook from '@/components/Send/AddressBook';
import SendForm from '@/components/Send/SendForm';
import SendReview from '@/components/Send/SendReview';
import SendSearch from '@/components/Send/SendSearch';
import TokenSelector from '@/components/Send/TokenSelector';
import TransactionStatus from '@/components/TransactionStatus';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import getTokenIcon from '@/lib/getTokenIcon';
import { SendModal } from '@/lib/types';
import { useSendStore } from '@/store/useSendStore';
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
  const {
    currentModal,
    previousModal,
    transaction,
    selectedToken,
    setModal,
  } = useSendStore();
  const router = useRouter();
  const { triggerElement } = useResponsiveModal();

  const isSendSearch = currentModal.name === SEND_MODAL.OPEN_SEND_SEARCH.name;
  const isForm = currentModal.name === SEND_MODAL.OPEN_FORM.name;
  const isTokenSelector = currentModal.name === SEND_MODAL.OPEN_TOKEN_SELECTOR.name;
  const isReview = currentModal.name === SEND_MODAL.OPEN_REVIEW.name;
  const isTransactionStatus = currentModal.name === SEND_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isAddressBook = currentModal.name === SEND_MODAL.OPEN_ADDRESS_BOOK.name;
  const isClose = currentModal.name === SEND_MODAL.CLOSE.name;
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
              className: 'h-12 pr-6 rounded-xl',
            })}
          >
            <Text className="text-primary-foreground font-bold text-base">{buttonText}</Text>
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

    return <SendSearch />;
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    if (isReview) return 'review';
    if (isTokenSelector) return 'token-selector';
    if (isForm) return 'form';
    if (isAddressBook) return 'address-book';
    return 'send-search';
  };

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    if (isReview) return 'Review';
    if (isTokenSelector) return 'Select token';
    if (isForm) return 'Send';
    if (isAddressBook) return 'Address Book';
    return 'Send';
  };

  const getContentClassName = () => {
    if(isSendSearch) return 'min-h-[40rem]';
    return '';
  };

  const getContainerClassName = () => {
    return '';
  };

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (value) {
        setModal(modal);
      } else {
        setModal(SEND_MODAL.CLOSE);
      }
    },
    [modal, setModal, router],
  );

  const handleBackPress = () => {
    if (isReview) {
      setModal(SEND_MODAL.OPEN_FORM);
    } else if (isTokenSelector) {
      setModal(SEND_MODAL.OPEN_FORM);
    } else if (isForm) {
      setModal(SEND_MODAL.OPEN_SEND_SEARCH);
    } else if (isAddressBook) {
      setModal(SEND_MODAL.OPEN_SEND_SEARCH);
    } else {
      setModal(SEND_MODAL.CLOSE);
    }
  };

  const shouldOpen = !isClose;

  const showBackButton = isForm || isTokenSelector || isReview || isAddressBook;

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
    handleOpenChange,
    handleBackPress,
  };
};

export default useSendOption;
