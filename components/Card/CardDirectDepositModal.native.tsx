import React, { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import HomeQR from '@/assets/images/home-qr';
import DepositPublicAddress from '@/components/DepositOption/DepositPublicAddress';
import DepositOption from '@/components/DepositOption/DepositOption';
import NeedHelp from '@/components/NeedHelp';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { createDirectDepositSession } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

type Step = 'options' | 'address';

const CLOSE_STATE: ModalState = { name: 'close', number: -1 };

const MODAL_STATES: Record<Step, ModalState> = {
  options: { name: 'options', number: 0 },
  address: { name: 'address', number: 2 },
};

const STEP_TITLES: Record<Step, string> = {
  options: 'Fund your card',
  address: 'Fund your card',
};

interface CardDirectDepositModalProps {
  trigger: React.ReactNode;
}

// Native version — useConnectModal is web-only in thirdweb so the
// "Send from your crypto wallet" option is omitted.
export default function CardDirectDepositModal({ trigger }: CardDirectDepositModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stepState, setStepState] = useState<{ current: Step; previous: ModalState }>({
    current: 'options',
    previous: CLOSE_STATE,
  });
  const [depositAddress, setDepositAddress] = useState<string | undefined>(undefined);

  const { mutate: prepareSession } = useMutation({
    mutationFn: ({ chainId, token }: { chainId: number; token: string }) =>
      withRefreshToken(() => createDirectDepositSession(chainId, token, 'RAIN_CARD')),
    onSuccess: data => {
      if (data?.walletAddress) setDepositAddress(data.walletAddress);
    },
  });

  const goToStep = useCallback((nextStep: Step) => {
    setStepState(prev => ({ current: nextStep, previous: MODAL_STATES[prev.current] }));
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setStepState({ current: 'options', previous: CLOSE_STATE });
      setDepositAddress(undefined);
    }
  }, []);

  const handleShareAddress = useCallback(() => {
    setDepositAddress(undefined);
    prepareSession({ chainId: 8453, token: 'USDC' });
    goToStep('address');
  }, [goToStep, prepareSession]);

  const handleBack = useCallback(() => {
    setStepState(prev => ({
      current: 'options',
      previous: MODAL_STATES[prev.current],
    }));
  }, []);

  const { current: step, previous: previousModal } = stepState;
  const currentModal = MODAL_STATES[step];
  const canGoBack = step !== 'options';

  const content = (() => {
    if (step === 'options') {
      return (
        <View className="gap-y-2.5">
          <DepositOption
            text="Share your deposit address"
            subtitle="Send supported tokens to your card deposit address from a supported network"
            icon={<HomeQR />}
            onPress={handleShareAddress}
          />
          <View className="mt-4 items-center">
            <NeedHelp />
          </View>
        </View>
      );
    }

    if (step === 'address') {
      return depositAddress ? (
        <DepositPublicAddress
          address={depositAddress}
          onDone={() => handleOpenChange(false)}
          excludeChainIds={[56]}
        />
      ) : (
        <View className="items-center py-12">
          <ActivityIndicator color="white" />
        </View>
      );
    }

    return null;
  })();

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      title={STEP_TITLES[step]}
      showBackButton={canGoBack}
      onBackPress={handleBack}
      shouldAnimate={previousModal.name !== 'close'}
      isForward={currentModal.number > previousModal.number}
      contentKey={step}
    >
      {content}
    </ResponsiveModal>
  );
}
