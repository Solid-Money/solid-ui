import React, { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import CardFundDepositAddress from '@/components/Card/CardFund/CardFundDepositAddress';
import CardFundNetworks from '@/components/Card/CardFund/CardFundNetworks';
import CardFundOptions from '@/components/Card/CardFund/CardFundOptions';
import {
  CARD_FUND_DESTINATION_TYPE,
  getCardFundTokenIcon,
  WIREX_CARD_FUND_SECTIONS,
} from '@/components/Card/CardFund/constants';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardProvider } from '@/hooks/useCardProvider';
import { track } from '@/lib/analytics';
import { createDirectDepositSession } from '@/lib/api';
import { CardProvider } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

type Step = 'options' | 'networks' | 'address';

const CLOSE_STATE: ModalState = { name: 'close', number: -1 };

const MODAL_STATES: Record<Step, ModalState> = {
  options: { name: 'options', number: 0 },
  networks: { name: 'networks', number: 1 },
  address: { name: 'address', number: 2 },
};

const TITLE_ICON_STYLE = { width: 24, height: 24, borderRadius: 12 };

export interface WirexCardFundModalProps {
  /** Omit (or pass null) when driving the modal with isOpen/onOpenChange. */
  trigger?: React.ReactNode;
  /** Controlled mode: when provided, the modal no longer owns its open state. */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * "Fund your card" for a Wirex cardholder.
 *
 * The same three steps as the Rain flow — pick a stablecoin, pick the chain it
 * is sent from, then deposit to the address shown — over the same deposit
 * address: `CARD_FUND_DESTINATION_TYPE` is the card address for either issuer,
 * and the backend resolves which one the cardholder has to decide where the
 * funds go (the Rain card on Base, or this cardholder's Safe on Fuse, where the
 * card spends from).
 *
 * What differs is only how much of the options screen is offered:
 * `WIREX_CARD_FUND_SECTIONS` leaves the stablecoin rows on and everything else
 * off until the matching backend leg exists. That is why this is a separate
 * component rather than a flag on `CardDirectDepositModal` — it needs none of
 * that modal's other machinery (thirdweb wallet connect, virtual accounts, the
 * buy-crypto onramp, the move-from-Solid handoff), so one file serves web
 * desktop, web mobile and native alike.
 */
export default function WirexCardFundModal({
  trigger = null,
  isOpen: isOpenProp,
  onOpenChange,
}: WirexCardFundModalProps) {
  const { provider } = useCardProvider();

  // Uncontrolled by default (trigger drives it); controlled when isOpen is passed,
  // e.g. by the home "Add Funds" pill, which has no trigger of its own.
  const isControlled = isOpenProp !== undefined;
  const [isOpenState, setIsOpenState] = useState(false);
  const isOpen = isControlled ? isOpenProp : isOpenState;
  const [stepState, setStepState] = useState<{ current: Step; previous: ModalState }>({
    current: 'options',
    previous: CLOSE_STATE,
  });
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(undefined);
  const [depositAddress, setDepositAddress] = useState<string | undefined>(undefined);

  const { mutate: prepareSession } = useMutation({
    mutationFn: ({ chainId, token }: { chainId: number; token: string }) =>
      withRefreshToken(() =>
        createDirectDepositSession(chainId, token, CARD_FUND_DESTINATION_TYPE),
      ),
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
        setStepState({ current: 'options', previous: CLOSE_STATE });
        setDepositAddress(undefined);
        setSelectedChainId(undefined);
      }
    },
    [isControlled, onOpenChange],
  );

  const handleTokenPress = useCallback(
    (symbol: string) => {
      setSelectedToken(symbol);
      setSelectedChainId(undefined);
      setDepositAddress(undefined);
      goToStep('networks');
    },
    [goToStep],
  );

  const handleNetworkSelect = useCallback(
    (chainId: number) => {
      track(TRACKING_EVENTS.NETWORK_SELECTED, {
        chain_id: chainId,
        token_symbol: selectedToken,
        deposit_type: 'wirex_card_direct_deposit',
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

  // The only entry point is already Wirex-only, but this is the chokepoint they
  // all pass through: a Rain cardholder must never be sent down this flow, whose
  // funds land in their Safe rather than on their card.
  if (provider !== CardProvider.WIREX) return null;

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
        <CardFundOptions onTokenPress={handleTokenPress} sections={WIREX_CARD_FUND_SECTIONS} />
      );
    }

    if (step === 'networks') {
      return <CardFundNetworks symbol={selectedToken} onSelect={handleNetworkSelect} />;
    }

    return (
      <CardFundDepositAddress
        address={depositAddress}
        symbol={selectedToken}
        chainId={selectedChainId ?? 0}
        onChangeNetwork={handleBack}
        onDepositDetected={handleDepositDetected}
      />
    );
  })();

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      title={title}
      titleIcon={titleIcon}
      // The funding flow is designed at phone width; 450px keeps the desktop
      // card at the same proportions instead of stretching to max-w-lg.
      contentClassName="md:max-w-[450px]"
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
