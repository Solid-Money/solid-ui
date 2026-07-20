import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Wallet } from 'lucide-react-native';
import { useActiveAccount, useConnectModal } from 'thirdweb/react';
import { useShallow } from 'zustand/react/shallow';

import HomeQR from '@/assets/images/home-qr';
import HomeSwap from '@/assets/images/home-swap';
import DepositNetwork from '@/components/DepositNetwork/DepositNetwork';
import AddFundsToWalletForm from '@/components/DepositOption/AddFundsToWalletForm';
import DepositOption from '@/components/DepositOption/DepositOption';
import DepositPublicAddress from '@/components/DepositOption/DepositPublicAddress';
import NeedHelp from '@/components/NeedHelp';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { createDirectDepositSession } from '@/lib/api';
import { cleanupThirdwebStyles, client, thirdwebTheme, thirdwebWallets } from '@/lib/thirdweb';
import { withRefreshToken } from '@/lib/utils';
import { getAllowedTokensForChain, getVaultDepositConfig } from '@/lib/vaults';
import { useCardDepositStore } from '@/store/useCardDepositStore';
import { useDepositStore } from '@/store/useDepositStore';

type Step = 'options' | 'networks' | 'form' | 'address';

const CLOSE_STATE: ModalState = { name: 'close', number: -1 };

const MODAL_STATES: Record<Step, ModalState> = {
  options: { name: 'options', number: 0 },
  networks: { name: 'networks', number: 1 },
  form: { name: 'form', number: 2 },
  address: { name: 'address', number: 2 },
};

const STEP_TITLES: Record<Step, string> = {
  options: 'Fund your card',
  networks: 'Fund your card',
  form: 'Fund your card',
  address: 'Fund your card',
};

interface CardDirectDepositModalProps {
  trigger: React.ReactNode;
}

export default function CardDirectDepositModal({ trigger }: CardDirectDepositModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stepState, setStepState] = useState<{ current: Step; previous: ModalState }>({
    current: 'options',
    previous: CLOSE_STATE,
  });
  // Deposit address fetched after chain selection (wallet path) or on QR button press (Base).
  const [depositAddress, setDepositAddress] = useState<string | undefined>(undefined);

  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const walletConnectingRef = useRef(false);
  const activeAccount = useActiveAccount();
  const { connect } = useConnectModal();
  const setDepositModal = useCardDepositStore(state => state.setModal);

  const { setSrcChainId, setPrincipalToken } = useDepositStore(
    useShallow(state => ({
      setSrcChainId: state.setSrcChainId,
      setPrincipalToken: state.setPrincipalToken,
    })),
  );

  const depositConfig = getVaultDepositConfig();

  // Fetched after the user picks a chain (wallet path) or immediately (QR path, Base chain).
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
    if (!open && walletConnectingRef.current) return;
    setIsOpen(open);
    if (!open) {
      setStepState({ current: 'options', previous: CLOSE_STATE });
      setDepositAddress(undefined);
    }
  }, []);

  const handleConnectWallet = useCallback(async () => {
    try {
      if (isWalletOpen) return;
      if (activeAccount?.address) {
        goToStep('networks');
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
      if (wallet) goToStep('networks');
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

  // "Share your deposit address" — address is chain-independent (same deterministic wallet
  // across all chains), so fetch via Base and skip network selection entirely.
  const handleShareAddress = useCallback(() => {
    setDepositAddress(undefined);
    prepareSession({ chainId: 8453, token: 'USDC' });
    goToStep('address');
  }, [goToStep, prepareSession]);

  // "Send from wallet" path only — always navigates to the send form.
  const handleNetworkSelect = useCallback(
    (chainId: number) => {
      // Card deposits are USDC-only, so the send form is locked to USDC.
      const selectedToken = 'USDC';
      const network = BRIDGE_TOKENS[chainId];

      track(TRACKING_EVENTS.NETWORK_SELECTED, {
        chain_id: chainId,
        network_name: network?.name,
        deposit_type: 'card_direct_deposit',
      });

      setSrcChainId(chainId);
      setPrincipalToken(selectedToken);

      setDepositAddress(undefined);
      prepareSession({ chainId, token: selectedToken });

      goToStep('form');
    },
    [setSrcChainId, setPrincipalToken, goToStep, prepareSession],
  );

  const handleBack = useCallback(() => {
    setStepState(prev => {
      const backStep: Step = (() => {
        if (prev.current === 'networks') return 'options';
        if (prev.current === 'form') return 'networks';
        if (prev.current === 'address') return 'options'; // QR path: back goes straight to options
        return 'options';
      })();
      return { current: backStep, previous: MODAL_STATES[prev.current] };
    });
  }, []);

  const { current: step, previous: previousModal } = stepState;
  const currentModal = MODAL_STATES[step];
  const canGoBack = step !== 'options';

  const content = (() => {
    if (step === 'options') {
      return (
        <View className="gap-y-2.5">
          <DepositOption
            text="Send from your crypto wallet"
            subtitle="Add supported assets from supported networks directly to your card"
            icon={<Wallet color="white" size={24} strokeWidth={1} />}
            onPress={handleConnectWallet}
            isLoading={isWalletOpen}
          />
          <DepositOption
            text="Share your deposit address"
            subtitle="Send supported tokens to your card deposit address from a supported network"
            icon={<HomeQR />}
            onPress={handleShareAddress}
          />
          <DepositOption
            text="Transfer from wallet/savings"
            subtitle="Transfer the funds from the assets you have in savings or wallet"
            icon={<HomeSwap />}
            onPress={handleTransferFromWallet}
          />
          <View className="mt-4 items-center">
            <NeedHelp />
          </View>
        </View>
      );
    }

    if (step === 'networks') {
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
                    onPress={() => handleNetworkSelect(chainId)}
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

    if (step === 'address') {
      return depositAddress ? (
        <DepositPublicAddress
          address={depositAddress}
          onDone={() => handleOpenChange(false)}
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
