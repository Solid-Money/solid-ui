import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { base } from 'viem/chains';

import HomeSwap from '@/assets/images/home-swap';
import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundNetworks from '@/components/Card/CardFund/CardFundNetworks';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import RhinoDepositAddress from '@/components/DepositOption/RhinoDeposit/RhinoDepositAddress';
import { getWalletDepositTokenIcon } from '@/components/DepositOption/WalletDepositAddress/constants';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useOfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';
import {
  AI_API_FUND_CHAIN_IDS,
  AI_API_FUND_TOKENS,
  AI_API_RHINO_DESTINATION,
  formatAiApiShortfall,
  getAiApiFundChips,
  isAiApiOwnRow,
} from '@/lib/aiApiFunding';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { resolveRhinoRow, RhinoDepositSelection } from '@/lib/rhinoDeposit';
import { useSwapState } from '@/store/swapStore';
import { useDepositStore } from '@/store/useDepositStore';

import type { CardFundNetwork } from '@/components/Card/CardFund/constants';

type Step = 'options' | 'networks' | 'address';

const CLOSE_STATE: ModalState = { name: 'close', number: -1 };

const MODAL_STATES: Record<Step, ModalState> = {
  options: { name: 'options', number: 0 },
  networks: { name: 'networks', number: 1 },
  address: { name: 'address', number: 2 },
};

/** Which step "back" returns to, for the steps that are not the first. */
const BACK_STEP: Partial<Record<Step, Step>> = {
  networks: 'options',
  address: 'networks',
};

/**
 * How long the next sheet waits for this one to close. Two sheets mounting at
 * once is what the card funding flow's same delay avoids too.
 */
const HANDOFF_DELAY_MS = 200;

const TOKEN_ICON_SIZE = 36;
const TOKEN_ICON_STYLE = {
  width: TOKEN_ICON_SIZE,
  height: TOKEN_ICON_SIZE,
  borderRadius: TOKEN_ICON_SIZE / 2,
};
const TITLE_ICON_STYLE = { width: 24, height: 24, borderRadius: 12 };

/** The app's own network rows, in the wallet's order, as the network list draws them. */
const AI_API_FUND_NETWORKS: CardFundNetwork[] = AI_API_FUND_CHAIN_IDS.flatMap(chainId => {
  const chain = getBridgeChain(chainId);
  return chain ? [{ chainId, name: chain.name, icon: chain.icon }] : [];
});

const appChainName = (chainId: number): string | undefined => getBridgeChain(chainId)?.name;

export interface AiApiFundModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the Wallet is missing for agents to run again, when the backend says. */
  shortfallUsd?: number | null;
}

/**
 * "Add funds" for the AI API, whose charges are paid from USDC in the Wallet on
 * Base. Two ways in, both ending there as USDC:
 *
 * - "Send crypto": USDC, USDT, ETH or BTC from an exchange or another wallet,
 *   through rhino.fi's AI API route, which converts it to USDC on the way. The
 *   same steps as funding the card: pick the token, then the network, then send
 *   to the address shown (`CardFundNetworks`, `RhinoDepositAddress`). USDC on
 *   Base needs no rhino.fi: it hands over to the Wallet's own address on Base,
 *   which is the screen this button opened before.
 * - "Swap to USDC on Base": anything already in the user's Solid wallet, on any
 *   network, Fuse included, through the swap form, preset to USDC on Base.
 *
 * Fuse is never a network here: rhino.fi does not take it, and money on Fuse
 * cannot pay for the AI API until the swap moves it.
 */
export default function AiApiFundModal({
  isOpen,
  onOpenChange,
  shortfallUsd,
}: AiApiFundModalProps) {
  const [stepState, setStepState] = useState<{ current: Step; previous: ModalState }>({
    current: 'options',
    previous: CLOSE_STATE,
  });
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [rhinoSelection, setRhinoSelection] = useState<RhinoDepositSelection | undefined>(
    undefined,
  );
  const rhinoAssets = useOfferedRhinoDepositAssets();

  const currentModal = MODAL_STATES[stepState.current];
  const currentModalRef = useRef<ModalState>(currentModal);
  currentModalRef.current = currentModal;

  const goToStep = useCallback((nextStep: Step) => {
    setStepState({ current: nextStep, previous: currentModalRef.current });
  }, []);

  // Back to the options, with nothing of the last visit kept.
  const resetFlow = useCallback(() => {
    setStepState({ current: 'options', previous: CLOSE_STATE });
    setRhinoSelection(undefined);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open);
      if (!open) resetFlow();
    },
    [onOpenChange, resetFlow],
  );

  // A parent that closes the modal never calls `handleOpenChange`.
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) resetFlow();
    wasOpenRef.current = isOpen;
  }, [isOpen, resetFlow]);

  const handleTokenPress = useCallback(
    (symbol: string) => {
      track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
        deposit_method: 'ai_api_send_crypto',
        selected_token: symbol,
      });
      setSelectedToken(symbol);
      setRhinoSelection(undefined);
      goToStep('networks');
    },
    [goToStep],
  );

  // USDC on Base is already what pays: the Wallet's own address on Base takes
  // it, in the deposit modal, which shows the Safe even to a Wirex cardholder.
  const openWalletAddressOnBase = useCallback(() => {
    handleOpenChange(false);
    setTimeout(() => {
      const { setWalletDeposit, setModal } = useDepositStore.getState();
      setWalletDeposit({
        symbol: 'USDC',
        chainId: base.id,
        isChangingToken: false,
        toSafe: true,
      });
      setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
    }, HANDOFF_DELAY_MS);
  }, [handleOpenChange]);

  // The list offers rhino.fi's rows and Base's USDC; nothing else is acted on.
  const handleNetworkSelect = useCallback(
    (chainId: number) => {
      const row = resolveRhinoRow(rhinoAssets, {
        chainId,
        destinationType: AI_API_RHINO_DESTINATION,
        symbol: selectedToken,
      });
      const isOwn = row.kind === 'own' && isAiApiOwnRow(chainId, selectedToken);
      if (row.kind !== 'rhino' && !isOwn) return;

      track(TRACKING_EVENTS.NETWORK_SELECTED, {
        chain_id: chainId,
        token_symbol: selectedToken,
        deposit_type: 'ai_api_deposit',
        via_rhino: row.kind === 'rhino',
      });

      if (row.kind === 'rhino') {
        setRhinoSelection(row.selection);
        goToStep('address');
        return;
      }
      openWalletAddressOnBase();
    },
    [goToStep, openWalletAddressOnBase, rhinoAssets, selectedToken],
  );

  // A "More networks" chain (Tron, Solana, Bitcoin, …): its rhino.fi address.
  const handleRhinoNetworkSelect = useCallback(
    (selection: RhinoDepositSelection) => {
      setRhinoSelection(selection);
      goToStep('address');
    },
    [goToStep],
  );

  // The swap form, preset to USDC on Base. This sheet closes first and the swap
  // opens once it has gone.
  const handleSwapPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'ai_api_swap' });
    handleOpenChange(false);
    setTimeout(() => {
      useSwapState.getState().actions.openSwap({
        entryPoint: 'ai_api',
        output: { address: ADDRESSES.base.usdc, chainId: base.id },
      });
    }, HANDOFF_DELAY_MS);
  }, [handleOpenChange]);

  const handleBack = useCallback(() => {
    setStepState(prev => ({
      current: BACK_STEP[prev.current] ?? 'options',
      previous: MODAL_STATES[prev.current],
    }));
  }, []);

  const isOwnRowOffered = useCallback(
    (chainId: number) => isAiApiOwnRow(chainId, selectedToken),
    [selectedToken],
  );

  const chips = useMemo(
    () =>
      Object.fromEntries(
        AI_API_FUND_TOKENS.map(symbol => [
          symbol,
          getAiApiFundChips(rhinoAssets.assets, symbol, appChainName),
        ]),
      ),
    [rhinoAssets.assets],
  );

  const { current: step, previous: previousModal } = stepState;
  const shortfall = formatAiApiShortfall(shortfallUsd);

  const title =
    step === 'networks'
      ? selectedToken
      : step === 'address'
        ? `Deposit ${selectedToken}`
        : 'Add funds';

  const titleIcon =
    step === 'networks' || step === 'address' ? (
      <Image
        source={getWalletDepositTokenIcon(selectedToken)}
        style={TITLE_ICON_STYLE}
        contentFit="cover"
      />
    ) : undefined;

  const content = (() => {
    if (step === 'networks') {
      return (
        <CardFundNetworks
          symbol={selectedToken}
          destinationType={AI_API_RHINO_DESTINATION}
          networks={AI_API_FUND_NETWORKS}
          isOwnRowOffered={isOwnRowOffered}
          onSelect={handleNetworkSelect}
          onSelectRhino={handleRhinoNetworkSelect}
        />
      );
    }

    if (step === 'address' && rhinoSelection) {
      return <RhinoDepositAddress selection={rhinoSelection} onChangeNetwork={handleBack} />;
    }

    return (
      <View className="gap-y-8">
        <View className="gap-y-1.5">
          <Text className="text-center text-[14px] leading-5 text-white/70">
            Your AI agents are paid from USDC in your wallet on Base.
          </Text>
          {shortfall ? (
            <Text className="text-center text-[14px] font-semibold leading-5 text-white">
              {shortfall}
            </Text>
          ) : null}
        </View>

        <CardFundGroup
          label="Send crypto"
          labelTooltip="From an exchange or another wallet. Whatever you send arrives as USDC in your wallet on Base."
          labelTooltipContext="ai_api_fund_send_crypto"
        >
          {AI_API_FUND_TOKENS.map(symbol => (
            <CardFundRow
              key={symbol}
              icon={
                <Image
                  source={getWalletDepositTokenIcon(symbol)}
                  style={TOKEN_ICON_STYLE}
                  contentFit="cover"
                />
              }
              title={symbol}
              chips={chips[symbol]}
              onPress={() => handleTokenPress(symbol)}
            />
          ))}
        </CardFundGroup>

        <CardFundGroup label="From your Solid balance">
          <CardFundRow
            icon={<HomeSwap width={22} height={22} stroke="#ffffff" viewBox="0 0 29 28" />}
            title="Swap to USDC on Base"
            subtitle="Use tokens you already hold in Solid, on any network"
            onPress={handleSwapPress}
          />
        </CardFundGroup>
      </View>
    );
  })();

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      trigger={null}
      title={title}
      titleIcon={titleIcon}
      // Designed at phone width, like the card's funding flow it is built from.
      contentClassName="md:max-w-[450px]"
      showBackButton={step !== 'options'}
      onBackPress={handleBack}
      shouldAnimate={previousModal.name !== 'close'}
      isForward={currentModal.number > previousModal.number}
      contentKey={step}
    >
      {content}
    </ResponsiveModal>
  );
}
