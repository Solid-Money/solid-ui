import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useActiveAccount, useConnectModal } from 'thirdweb/react';
import { useShallow } from 'zustand/react/shallow';

import CardFundDepositAddress from '@/components/Card/CardFund/CardFundDepositAddress';
import CardFundNetworks from '@/components/Card/CardFund/CardFundNetworks';
import CardFundOptions from '@/components/Card/CardFund/CardFundOptions';
import { getCardFundTokenIcon } from '@/components/Card/CardFund/constants';
import DepositNetwork from '@/components/DepositNetwork/DepositNetwork';
import AddFundsToWalletForm from '@/components/DepositOption/AddFundsToWalletForm';
import VirtualAccountApplyDialog from '@/components/DepositOption/VirtualAccountDetails/VirtualAccountApplyDialog';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { CARD_DEPOSIT_MODAL, DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBuyCryptoEntry } from '@/hooks/useBuyCryptoEntry';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { useVirtualAccountProvider } from '@/hooks/useVirtualAccountProvider';
import { track } from '@/lib/analytics';
import { createDirectDepositSession } from '@/lib/api';
import { cleanupThirdwebStyles, client, thirdwebTheme, thirdwebWallets } from '@/lib/thirdweb';
import { DepositModal, RainApplicationStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { getAllowedTokensForChain, getVaultDepositConfig } from '@/lib/vaults';
import { useCardDepositStore } from '@/store/useCardDepositStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

type Step = 'options' | 'networks' | 'address' | 'walletNetworks' | 'form';

const CLOSE_STATE: ModalState = { name: 'close', number: -1 };

const MODAL_STATES: Record<Step, ModalState> = {
  options: { name: 'options', number: 0 },
  networks: { name: 'networks', number: 1 },
  walletNetworks: { name: 'wallet-networks', number: 1 },
  address: { name: 'address', number: 2 },
  form: { name: 'form', number: 2 },
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

export default function CardDirectDepositModal({
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
  // Token + chain picked in the direct-deposit flow (Stablecoins section).
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(undefined);
  // Deposit address fetched after chain selection (both the direct-deposit and
  // the connected-wallet paths send to the same session wallet).
  const [depositAddress, setDepositAddress] = useState<string | undefined>(undefined);

  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const walletConnectingRef = useRef(false);
  const activeAccount = useActiveAccount();
  const { connect } = useConnectModal();
  const setDepositModal = useCardDepositStore(state => state.setModal);
  const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setSrcChainId, setPrincipalToken, setWalletModal } = useDepositStore(
    useShallow(state => ({
      setSrcChainId: state.setSrcChainId,
      setPrincipalToken: state.setPrincipalToken,
      setWalletModal: state.setModal,
    })),
  );

  const { handleBuyCryptoPress } = useBuyCryptoEntry();
  const resetTransfi = useTransfiStore(state => state.reset);
  const setTransfiCurrency = useTransfiStore(state => state.setFiatCurrency);

  // Same existing-automation check the wallet "Add funds" -> Cash flow uses
  // (DepositTypeSelection.handleCashPress) - reused here so "USD" opens the
  // exact same virtual-account details/apply screen, not a separate copy.
  const { data: cardStatus } = useCardStatus();
  const isRainApproved = cardStatus?.rainApplicationStatus === RainApplicationStatus.APPROVED;
  const { data: existingAutomation } = useOnrampAutomation(isRainApproved);
  const { provider: virtualAccountProvider } = useVirtualAccountProvider();

  const depositConfig = getVaultDepositConfig();

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
      if (!open && walletConnectingRef.current) return;
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
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'bank_transfer',
      provider: virtualAccountProvider,
    });
    // A Wirex user has no Rain automation and never will, so the Rain apply
    // dialog is not the right next step — their details screen owns activation.
    if (virtualAccountProvider !== 'wirex' && !existingAutomation) {
      setIsVirtualAccountApplyOpen(true);
      return;
    }

    handleOpenChange(false);
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    handoffTimer.current = setTimeout(() => {
      setWalletModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
    }, HANDOFF_DELAY_MS);
  }, [handleOpenChange, existingAutomation, setWalletModal, virtualAccountProvider]);

  const handleVirtualAccountTransition = useCallback(
    (modal: DepositModal) => {
      setIsVirtualAccountApplyOpen(false);
      handleOpenChange(false);
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
      handoffTimer.current = setTimeout(() => setWalletModal(modal), HANDOFF_DELAY_MS);
    },
    [handleOpenChange, setWalletModal],
  );

  // A local currency (BRL, BDT…) starts a fresh onramp preseeded with it. The
  // buy-crypto steps live in the global deposit modal, so hand off the same way
  // the USD row does and let useBuyCryptoEntry route to KYC or the amount screen.
  // The bought USDC is delivered to the card funding address, so it arrives as
  // card balance — which is why this belongs in the card funding flow at all.
  const handleLocalCurrencyPress = useCallback(
    (code: string) => {
      track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
        deposit_method: 'buy_crypto',
        currency: code,
      });
      resetTransfi();
      setTransfiCurrency(code);

      handleOpenChange(false);
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
      handoffTimer.current = setTimeout(() => {
        void handleBuyCryptoPress();
      }, HANDOFF_DELAY_MS);
    },
    [handleBuyCryptoPress, handleOpenChange, resetTransfi, setTransfiCurrency],
  );

  // "Deposit from an external wallet" — connect a crypto wallet, then send.
  const handleConnectWallet = useCallback(async () => {
    try {
      if (isWalletOpen) return;
      if (activeAccount?.address) {
        goToStep('walletNetworks');
        return;
      }
      setIsWalletOpen(true);
      walletConnectingRef.current = true;
      const wallet = await connect({
        client,
        showThirdwebBranding: false,
        size: 'compact',
        wallets: thirdwebWallets,
        theme: thirdwebTheme,
      });
      if (wallet) goToStep('walletNetworks');
    } catch {
      // ignore dismiss
    } finally {
      walletConnectingRef.current = false;
      setIsWalletOpen(false);
      cleanupThirdwebStyles();
    }
  }, [isWalletOpen, connect, activeAccount, goToStep]);

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

  // Direct-deposit path: pick the chain the stablecoin is sent from.
  const handleDirectNetworkSelect = useCallback(
    (chainId: number) => {
      track(TRACKING_EVENTS.NETWORK_SELECTED, {
        chain_id: chainId,
        network_name: BRIDGE_TOKENS[chainId]?.name,
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

  // Connected-wallet path only — always navigates to the send form.
  const handleWalletNetworkSelect = useCallback(
    (chainId: number) => {
      // Card deposits from a connected wallet are USDC-only.
      const token = 'USDC';
      const network = BRIDGE_TOKENS[chainId];

      track(TRACKING_EVENTS.NETWORK_SELECTED, {
        chain_id: chainId,
        network_name: network?.name,
        deposit_type: 'card_direct_deposit',
      });

      setSrcChainId(chainId);
      setPrincipalToken(token);

      setDepositAddress(undefined);
      prepareSession({ chainId, token });

      goToStep('form');
    },
    [setSrcChainId, setPrincipalToken, goToStep, prepareSession],
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
    setStepState(prev => {
      const backStep: Step = (() => {
        if (prev.current === 'address') return 'networks';
        if (prev.current === 'form') return 'walletNetworks';
        return 'options';
      })();
      return { current: backStep, previous: MODAL_STATES[prev.current] };
    });
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
          onExternalWalletPress={handleConnectWallet}
          onUsdPress={handleUsdPress}
          onLocalCurrencyPress={handleLocalCurrencyPress}
          isExternalWalletLoading={isWalletOpen}
        />
      );
    }

    if (step === 'networks') {
      return <CardFundNetworks symbol={selectedToken} onSelect={handleDirectNetworkSelect} />;
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

    if (step === 'walletNetworks') {
      return (
        <View className="min-h-[33rem] gap-y-2">
          <Text className="text-[1rem] font-medium text-muted-foreground">Choose a network</Text>
          <View className="gap-y-1.5">
            {Object.entries(BRIDGE_TOKENS)
              .sort((a, b) => a[1].sort - b[1].sort)
              .filter(([id]) => depositConfig.supportedChains.includes(Number(id)))
              .filter(([id]) => getAllowedTokensForChain(Number(id)).length > 0)
              .map(([id, network]) => {
                const chainId = Number(id);
                const estimatedDesc =
                  chainId === 1 ? 'Estimated speed: 5 min' : 'Estimated speed: 20 min';
                return (
                  <DepositNetwork
                    key={network.name}
                    name={network.name}
                    description={estimatedDesc}
                    icon={network.icon}
                    isComingSoon={network.isComingSoon}
                    onPress={() => handleWalletNetworkSelect(chainId)}
                  />
                );
              })}
          </View>
        </View>
      );
    }

    if (step === 'form') {
      return depositAddress ? (
        <AddFundsToWalletForm
          destinationAddress={depositAddress}
          onSuccess={() => handleOpenChange(false)}
          lockToken
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
    <>
      <ResponsiveModal
        currentModal={currentModal}
        previousModal={previousModal}
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        trigger={trigger}
        title={title}
        titleIcon={titleIcon}
        // The funding flow is designed at phone width; 420px keeps the desktop
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

      <VirtualAccountApplyDialog
        isOpen={isVirtualAccountApplyOpen}
        onClose={() => setIsVirtualAccountApplyOpen(false)}
        onRequestDepositModal={handleVirtualAccountTransition}
      />
    </>
  );
}
