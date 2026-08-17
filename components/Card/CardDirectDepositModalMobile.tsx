import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import CardFundDepositAddress from '@/components/Card/CardFund/CardFundDepositAddress';
import CardFundNetworks from '@/components/Card/CardFund/CardFundNetworks';
import CardFundOptions from '@/components/Card/CardFund/CardFundOptions';
import { getCardFundTokenIcon } from '@/components/Card/CardFund/constants';
import DepositPublicAddress from '@/components/DepositOption/DepositPublicAddress';
import VirtualAccountApplyDialog from '@/components/DepositOption/VirtualAccountDetails/VirtualAccountApplyDialog';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { CARD_DEPOSIT_MODAL, DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { track } from '@/lib/analytics';
import { createDirectDepositSession } from '@/lib/api';
import { DepositModal, RainApplicationStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useCardDepositStore } from '@/store/useCardDepositStore';
import { useDepositStore } from '@/store/useDepositStore';

type Step = 'options' | 'networks' | 'address' | 'externalAddress';

const CLOSE_STATE: ModalState = { name: 'close', number: -1 };

const MODAL_STATES: Record<Step, ModalState> = {
  options: { name: 'options', number: 0 },
  networks: { name: 'networks', number: 1 },
  externalAddress: { name: 'external-address', number: 1 },
  address: { name: 'address', number: 2 },
};

/**
 * Wait out this modal's exit animation before opening the global wallet
 * deposit modal for "Cash" - mounting the next dialog in the same commit as
 * this one unmounts leaves the closing sheet's view on top of the new one,
 * swallowing its taps.
 */
const HANDOFF_DELAY_MS = 260;

const TITLE_ICON_STYLE = { width: 24, height: 24, borderRadius: 12 };

interface CardDirectDepositModalProps {
  trigger?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Shared mobile variant (native + web-mobile). External wallet connect
// (thirdweb useConnectModal) is desktop-only, so "Deposit from an external
// wallet" shows the shared deposit address here instead of a connect flow.
export default function CardDirectDepositModalMobile({
  trigger = null,
  isOpen: isOpenProp,
  onOpenChange,
}: CardDirectDepositModalProps) {
  // Uncontrolled by default (trigger drives it); controlled when isOpen is passed,
  // e.g. by the home "Add funds" destination picker which has no trigger of its own.
  const isControlled = isOpenProp !== undefined;
  const [isOpenState, setIsOpenState] = useState(false);
  const isOpen = isControlled ? isOpenProp : isOpenState;
  const [isVirtualAccountApplyOpen, setIsVirtualAccountApplyOpen] = useState(false);
  const [stepState, setStepState] = useState<{ current: Step; previous: ModalState }>({
    current: 'options',
    previous: CLOSE_STATE,
  });
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(undefined);
  const [depositAddress, setDepositAddress] = useState<string | undefined>(undefined);

  const setDepositModal = useCardDepositStore(state => state.setModal);
  const setWalletModal = useDepositStore(state => state.setModal);
  const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Same existing-automation check the wallet "Add funds" -> Cash flow uses
  // (DepositTypeSelection.handleCashPress) - reused here so "USD" opens the
  // exact same virtual-account details/apply screen, not a separate copy.
  const { data: cardStatus } = useCardStatus();
  const isRainApproved = cardStatus?.rainApplicationStatus === RainApplicationStatus.APPROVED;
  const { data: existingAutomation } = useOnrampAutomation(isRainApproved);

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

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!isControlled) setIsOpenState(open);
      onOpenChange?.(open);
      if (!open) {
        setIsVirtualAccountApplyOpen(false);
        setStepState({ current: 'options', previous: CLOSE_STATE });
        setDepositAddress(undefined);
        setSelectedChainId(undefined);
      }
    },
    [isControlled, onOpenChange],
  );

  useEffect(
    () => () => {
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
    },
    [],
  );

  // First-time setup stacks above this funding dialog so closing it returns to
  // "Fund your card". Existing accounts still hand off to the global details flow.
  const handleUsdPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'bank_transfer' });
    if (!existingAutomation) {
      setIsVirtualAccountApplyOpen(true);
      return;
    }

    handleOpenChange(false);
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    handoffTimer.current = setTimeout(() => {
      setWalletModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
    }, HANDOFF_DELAY_MS);
  }, [handleOpenChange, existingAutomation, setWalletModal]);

  const handleVirtualAccountTransition = useCallback(
    (modal: DepositModal) => {
      setIsVirtualAccountApplyOpen(false);
      handleOpenChange(false);
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
      handoffTimer.current = setTimeout(() => setWalletModal(modal), HANDOFF_DELAY_MS);
    },
    [handleOpenChange, setWalletModal],
  );

  const handleTransferFromWallet = useCallback(() => {
    handleOpenChange(false);
    setDepositModal(CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM);
  }, [handleOpenChange, setDepositModal]);

  const handleTokenPress = useCallback(
    (symbol: string) => {
      setSelectedToken(symbol);
      setSelectedChainId(undefined);
      setDepositAddress(undefined);
      goToStep('networks');
    },
    [goToStep],
  );

  // "Deposit from an external wallet" — the chain-independent share-address flow.
  const handleExternalWallet = useCallback(() => {
    setDepositAddress(undefined);
    prepareSession({ chainId: 8453, token: 'USDC' });
    goToStep('externalAddress');
  }, [goToStep, prepareSession]);

  const handleNetworkSelect = useCallback(
    (chainId: number) => {
      track(TRACKING_EVENTS.NETWORK_SELECTED, {
        chain_id: chainId,
        token_symbol: selectedToken,
        deposit_type: 'card_direct_deposit',
      });

      setSelectedChainId(chainId);
      setDepositAddress(undefined);
      prepareSession({ chainId, token: selectedToken });
      goToStep('address');
    },
    [goToStep, prepareSession, selectedToken],
  );

  // The webhook has seen the transfer — hand the user straight to its progress screen.
  const handleDepositDetected = useCallback(
    (clientTxId: string) => {
      handleOpenChange(false);
      router.push(`/activity/${clientTxId}`);
    },
    [handleOpenChange],
  );

  const handleBack = useCallback(() => {
    setStepState(prev => ({
      current: prev.current === 'address' ? 'networks' : 'options',
      previous: MODAL_STATES[prev.current],
    }));
  }, []);

  const { current: step, previous: previousModal } = stepState;
  const currentModal = MODAL_STATES[step];
  const canGoBack = step !== 'options';

  const title = (() => {
    if (step === 'networks') return selectedToken;
    if (step === 'address') return `Deposit ${selectedToken}`;
    return 'Fund your card';
  })();

  const titleIcon =
    step === 'networks' || step === 'address' ? (
      <Image
        source={getCardFundTokenIcon(selectedToken)}
        style={TITLE_ICON_STYLE}
        contentFit="cover"
      />
    ) : undefined;

  const content = (() => {
    if (step === 'options') {
      return (
        <CardFundOptions
          onTokenPress={handleTokenPress}
          onMoveFromSavingsPress={handleTransferFromWallet}
          onExternalWalletPress={handleExternalWallet}
          onUsdPress={handleUsdPress}
        />
      );
    }

    if (step === 'networks') {
      return <CardFundNetworks symbol={selectedToken} onSelect={handleNetworkSelect} />;
    }

    if (step === 'address') {
      return (
        <CardFundDepositAddress
          address={depositAddress}
          symbol={selectedToken}
          chainId={selectedChainId ?? 0}
          onChangeNetwork={handleBack}
          onDepositDetected={handleDepositDetected}
        />
      );
    }

    if (step === 'externalAddress') {
      return depositAddress ? (
        <DepositPublicAddress address={depositAddress} onDone={() => handleOpenChange(false)} />
      ) : (
        <View className="items-center py-12">
          <ActivityIndicator color="white" />
        </View>
      );
    }

    return null;
  })();

  return (
    <>
      <ResponsiveModal
        currentModal={currentModal}
        previousModal={previousModal}
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        trigger={trigger}
        title={title}
        titleIcon={titleIcon}
        // The funding flow is designed at phone width; 420px keeps the web-tablet
        // card at the same proportions instead of stretching to max-w-lg.
        contentClassName="md:max-w-[420px]"
        showBackButton={canGoBack}
        onBackPress={handleBack}
        shouldAnimate={previousModal.name !== 'close'}
        isForward={currentModal.number > previousModal.number}
        contentKey={step}
      >
        {content}
      </ResponsiveModal>

      <VirtualAccountApplyDialog
        isOpen={isVirtualAccountApplyOpen}
        onClose={() => setIsVirtualAccountApplyOpen(false)}
        onRequestDepositModal={handleVirtualAccountTransition}
      />
    </>
  );
}
