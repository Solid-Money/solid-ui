import { useRouter } from 'expo-router';
import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import ResponsiveModal from '@/components/ResponsiveModal';
import SwapButton from '@/components/Swap/SwapButton';
import SwapPair from '@/components/Swap/SwapPair';
import SwapParams from '@/components/Swap/SwapParams';
import TransactionStatus from '@/components/TransactionStatus';
import { Text } from '@/components/ui/text';
import { SWAP_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import getTokenIcon from '@/lib/getTokenIcon';
import { useIntercom } from '@/lib/intercom';
import { useSwapState } from '@/store/swapStore';
import { MessageCircle } from 'lucide-react-native';

type SwapModalProps = {
  trigger?: ReactNode;
  defaultOpen?: boolean;
  onClose?: () => void;
};

const SwapModal = ({ trigger = null, defaultOpen = false, onClose }: SwapModalProps) => {
  const router = useRouter();
  const intercom = useIntercom();

  const {
    currentModal,
    previousModal,
    transaction,
    actions: { setModal },
  } = useSwapState();

  const [isReady, setIsReady] = useState(false);

  const isTransactionStatus = currentModal.name === SWAP_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === SWAP_MODAL.CLOSE.name;

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setIsReady(true);
      if (defaultOpen) {
        setModal(SWAP_MODAL.OPEN_FORM);
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [defaultOpen, setModal]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (value) {
        setModal(SWAP_MODAL.OPEN_FORM);
      } else {
        setModal(SWAP_MODAL.CLOSE);
        onClose?.();
      }
    },
    [setModal, onClose],
  );

  const handleTransactionStatusPress = useCallback(() => {
    setModal(SWAP_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  }, [router, setModal]);

  const title = useMemo(() => {
    if (isTransactionStatus) return undefined;
    return 'Swap';
  }, [isTransactionStatus]);

  const contentKey = useMemo(() => {
    if (isTransactionStatus) return 'transaction-status';
    return 'swap-form';
  }, [isTransactionStatus]);

  const content = useMemo(() => {
    if (!isReady) {
      return (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator size="large" color="white" />
        </View>
      );
    }

    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          address={transaction.address}
          onPress={handleTransactionStatusPress}
          title="Transaction completed"
          description="Your transaction has been successfully processed and confirmed."
          status="Completed"
          token={transaction.inputCurrencySymbol ?? 'Token'}
          icon={getTokenIcon({
            tokenSymbol: transaction.inputCurrencySymbol,
            size: 24,
          })}
        />
      );
    }

    return (
      <View className="flex flex-col gap-4 md:gap-6">
        <SwapPair />
        <SwapParams />
        <View className="mt-2">
          <SwapButton />
        </View>
        <Pressable
          className="flex-row items-center justify-center gap-2 pt-2 opacity-80"
          onPress={() => intercom?.show()}
        >
          <MessageCircle size={18} color="white" />
          <Text className="text-base font-medium text-white">Need help?</Text>
        </Pressable>
      </View>
    );
  }, [isReady, isTransactionStatus, transaction, handleTransactionStatusPress, intercom]);

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      title={title}
      titleClassName="items-center w-full"
      containerClassName="w-full max-w-md"
      contentClassName="md:max-w-md w-full"
      showBackButton={false}
      contentKey={contentKey}
    >
      {content}
    </ResponsiveModal>
  );
};

export default SwapModal;
