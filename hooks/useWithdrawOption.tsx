import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, PressableProps, View } from 'react-native';

import TransactionStatus from '@/components/TransactionStatus';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import WithdrawOptions from '@/components/Unstake/WithdrawOptions';
import WithdrawNetworks from '@/components/Unstake/WithdrawNetworks';
import FastWithdrawForm from '@/components/Unstake/FastWithdrawForm';
import RegularWithdrawForm from '@/components/Unstake/RegularWithdrawForm';
import { UNSTAKE_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import getTokenIcon from '@/lib/getTokenIcon';
import { UnstakeModal } from '@/lib/types';
import { useUnstakeStore } from '@/store/useUnstakeStore';
import useResponsiveModal from './useResponsiveModal';
import { Minus } from 'lucide-react-native';

export interface WithdrawOptionProps {
  buttonText?: string;
  trigger?: React.ReactNode;
  modal?: UnstakeModal;
}

const useWithdrawOption = ({
  buttonText = 'Withdraw',
  trigger,
  modal = UNSTAKE_MODAL.OPEN_OPTIONS,
}: WithdrawOptionProps = {}) => {
  const {
    currentModal,
    previousModal,
    transaction,
    setModal,
  } = useUnstakeStore();
  const router = useRouter();
  const { isScreenMedium } = useDimension();
  const { triggerElement } = useResponsiveModal();

  const isOptions = currentModal.name === UNSTAKE_MODAL.OPEN_OPTIONS.name;
  const isNetworks = currentModal.name === UNSTAKE_MODAL.OPEN_NETWORKS.name;
  const isFastForm = currentModal.name === UNSTAKE_MODAL.OPEN_FAST_WITHDRAW_FORM.name;
  const isRegularForm = currentModal.name === UNSTAKE_MODAL.OPEN_FORM.name; // Reusing OPEN_FORM for regular
  const isTransactionStatus = currentModal.name === UNSTAKE_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === UNSTAKE_MODAL.CLOSE.name;
  const shouldAnimate = previousModal.name !== UNSTAKE_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const handleTransactionStatusPress = useCallback(() => {
    setModal(UNSTAKE_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  }, [router, setModal]);

  const Trigger = ({ children, ...props }: PressableProps & { children?: React.ReactNode }) => {
    return (
      <Pressable
        {...props}
        className='flex-1'
        onPress={e => {
          if (isScreenMedium) {
            props?.onPress?.(e);
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
              variant: 'secondary',
              className: 'h-12 px-6 rounded-xl bg-[#303030] border-0',
            })}
          >
            <View className="flex-row items-center gap-2">
               <Minus size={20} color="white" />
              <Text className="text-base text-white font-bold">{buttonText}</Text>
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
          token={'SoUSD'}
          icon={getTokenIcon({ tokenSymbol: 'SoUSD' })}
        />
      );
    }

    if (isNetworks) {
      return <WithdrawNetworks />;
    }

    if (isFastForm) {
      return <FastWithdrawForm />;
    }

    if (isRegularForm) {
      return <RegularWithdrawForm />;
    }

    return <WithdrawOptions />;
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    if (isNetworks) return 'networks';
    if (isFastForm) return 'fast-withdraw-form';
    if (isRegularForm) return 'regular-withdraw-form';
    return 'withdraw-options';
  };

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    if (isNetworks) return 'Select a network';
    if (isFastForm) return 'Fast withdraw';
    if (isRegularForm) return 'Regular withdraw';
    return 'Withdraw from savings';
  };

  const getContentClassName = () => {
    // Add custom styling if needed for specific modals
    return '';
  };

  const getContainerClassName = () => {
    return '';
  };

  const handleOpenChange = (value: boolean) => {
    if (value) {
      setModal(modal);
    } else {
      setModal(UNSTAKE_MODAL.CLOSE);
    }
  };

  const handleBackPress = () => {
    if (isFastForm) {
      setModal(UNSTAKE_MODAL.OPEN_NETWORKS);
    } else if (isNetworks) {
      setModal(UNSTAKE_MODAL.OPEN_OPTIONS);
    } else if (isRegularForm) {
      setModal(UNSTAKE_MODAL.OPEN_OPTIONS);
    } else {
      setModal(UNSTAKE_MODAL.CLOSE);
    }
  };

  // Open the modal for all states except when explicitly closed
  const shouldOpen = !isClose;

  const showBackButton = isNetworks || isFastForm || isRegularForm;

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

