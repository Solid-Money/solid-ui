import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, PressableProps, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import TransactionStatus from '@/components/TransactionStatus';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import RegularWithdrawForm from '@/components/Unstake/RegularWithdrawForm';
import UnstakeTokenSelector from '@/components/Unstake/UnstakeTokenSelector';
import { UNSTAKE_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import getTokenIcon from '@/lib/getTokenIcon';
import { UnstakeModal } from '@/lib/types';
import { useUnstakeStore } from '@/store/useUnstakeStore';
import { Minus } from 'lucide-react-native';
import useResponsiveModal from './useResponsiveModal';

export interface WithdrawOptionProps {
  buttonText?: string;
  trigger?: React.ReactNode;
  modal?: UnstakeModal;
}

const useWithdrawOption = ({
  buttonText = 'Withdraw',
  trigger,
  modal = UNSTAKE_MODAL.OPEN_FORM,
}: WithdrawOptionProps = {}) => {
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { currentModal, previousModal, transaction, setModal } = useUnstakeStore(
    useShallow(state => ({
      currentModal: state.currentModal,
      previousModal: state.previousModal,
      transaction: state.transaction,
      setModal: state.setModal,
    })),
  );
  const router = useRouter();
  const { isScreenMedium } = useDimension();
  const { triggerElement } = useResponsiveModal();

  const isRegularForm = currentModal.name === UNSTAKE_MODAL.OPEN_FORM.name;
  const isTokenSelector = currentModal.name === UNSTAKE_MODAL.OPEN_TOKEN_SELECTOR.name;
  const isTransactionStatus = currentModal.name === UNSTAKE_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === UNSTAKE_MODAL.CLOSE.name;
  const shouldAnimate = previousModal.name !== UNSTAKE_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const handleTransactionStatusPress = useCallback(() => {
    setModal(UNSTAKE_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  }, [router, setModal]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (value) {
        setModal(modal);
      } else {
        setModal(UNSTAKE_MODAL.CLOSE);
      }
    },
    [modal, setModal],
  );

  const getTrigger = useCallback(
    (props?: PressableProps) => {
      const Trigger = ({
        children,
        ...triggerProps
      }: PressableProps & { children?: React.ReactNode }) => {
        return (
          <Pressable
            {...triggerProps}
            className="flex-1"
            onPress={e => {
              if (isScreenMedium) {
                triggerProps?.onPress?.(e);
              } else {
                handleOpenChange(true);
              }
            }}
          >
            {triggerElement(children)}
          </Pressable>
        );
      };

      if (trigger) {
        return <Trigger {...props}>{trigger}</Trigger>;
      }

      return (
        <Trigger {...props}>
          <View
            className={buttonVariants({
              variant: 'secondary',
              className: 'h-12 rounded-xl border-0 bg-[#303030] px-6',
            })}
          >
            <View className="flex-row items-center gap-2">
              <Minus size={20} color="white" />
              <Text className="text-base font-bold text-white">{buttonText}</Text>
            </View>
          </View>
        </Trigger>
      );
    },
    [trigger, buttonText, isScreenMedium, triggerElement, handleOpenChange],
  );

  const getContent = () => {
    if (isTransactionStatus) {
      const tokenSymbol = transaction.symbol ?? 'SoUSD';
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          onPress={handleTransactionStatusPress}
          token={tokenSymbol}
          icon={getTokenIcon({ tokenSymbol })}
        />
      );
    }

    if (isTokenSelector) {
      return <UnstakeTokenSelector />;
    }

    return <RegularWithdrawForm />;
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    if (isTokenSelector) return 'token-selector';
    return 'regular-withdraw-form';
  };

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    if (isTokenSelector) return 'Select token';
    return 'Withdraw from savings';
  };

  const getContentClassName = () => {
    // Add custom styling if needed for specific modals
    return '';
  };

  const getContainerClassName = () => {
    return '';
  };

  const handleBackPress = () => {
    setModal(UNSTAKE_MODAL.CLOSE);
  };

  // Open the modal for all states except when explicitly closed
  const shouldOpen = !isClose;

  const showBackButton = isRegularForm || isTokenSelector;

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

export default useWithdrawOption;
