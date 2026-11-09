import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useActiveAccount, useConnectModal } from 'thirdweb/react';
import { useShallow } from 'zustand/react/shallow';

import { BuyCryptoFlowContent } from '@/components/BuyCrypto/Transfi/BuyCryptoFlow';
import CardFundDepositAddress from '@/components/Card/CardFund/CardFundDepositAddress';
import CardFundNetworks from '@/components/Card/CardFund/CardFundNetworks';
import CardFundOptions from '@/components/Card/CardFund/CardFundOptions';
import {
  CARD_FUND_DESTINATION_TYPE,
  getCardFundRhinoDestination,
  getCardFundTokenIcon,
} from '@/components/Card/CardFund/constants';
import DepositNetwork from '@/components/DepositNetwork/DepositNetwork';
import AddFundsToWalletForm from '@/components/DepositOption/AddFundsToWalletForm';
import { UsdMethodList } from '@/components/DepositOption/DepositUsdOptions';
import RhinoDepositAddress from '@/components/DepositOption/RhinoDeposit/RhinoDepositAddress';
import RhinoNetworksNotice from '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice';
import VirtualAccountApplyDialog from '@/components/DepositOption/VirtualAccountDetails/VirtualAccountApplyDialog';
import { OrchestraFlowContent } from '@/components/Orchestra/OrchestraFlow';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { CARD_DEPOSIT_MODAL, DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBuyCryptoEntry } from '@/hooks/useBuyCryptoEntry';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useHasFeature } from '@/hooks/useFeatureAccess';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { useOrchestraCardEntry } from '@/hooks/useOrchestraCardEntry';
import { useRhinoDepositAddress } from '@/hooks/useRhinoDepositAddress';
import { useOfferedRhinoDepositAssets, useRhinoNetworkRows } from '@/hooks/useRhinoDepositAssets';
import { useVirtualAccountProvider } from '@/hooks/useVirtualAccountProvider';
import { track } from '@/lib/analytics';
import { createDirectDepositSession } from '@/lib/api';
import {
  getBuyCryptoBackTarget,
  getBuyCryptoTitle,
  getEmbeddedBuyCryptoTarget,
} from '@/lib/buyCryptoFlow';
import { EXPO_PUBLIC_MINIMUM_CARD_DEPOSIT_AMOUNT } from '@/lib/config';
import { getOrchestraBackTarget, getOrchestraTitle, isOrchestraModal } from '@/lib/orchestraFlow';
import {
  findRhinoRoute,
  getRhinoListNotice,
  isOfferedRhinoRow,
  resolveRhinoRow,
  RhinoDepositSelection,
} from '@/lib/rhinoDeposit';
import { cleanupThirdwebStyles, client, thirdwebTheme, thirdwebWallets } from '@/lib/thirdweb';
import { CardProvider, DepositModal, RainApplicationStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { getAllowedTokensForChain, getVaultDepositConfig } from '@/lib/vaults';
import { useCardDepositStore } from '@/store/useCardDepositStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

type Step = 'options' | 'usdMethods' | 'networks' | 'address' | 'walletNetworks' | 'form';

const CLOSE_STATE: ModalState = { name: 'close', number: -1 };

const MODAL_STATES: Record<Step, ModalState> = {
  options: { name: 'options', number: 0 },
  usdMethods: { name: 'usd-methods', number: 1 },
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
/**
 * Both embedded flows render in this shell, so the host asks whichever owns the
 * step for its title and back target rather than keeping a second copy.
 */
const getEmbeddedBackTarget = (modal: DepositModal) =>
  isOrchestraModal(modal) ? getOrchestraBackTarget(modal) : getBuyCryptoBackTarget(modal);

const getEmbeddedTitle = (modal: DepositModal) =>
  isOrchestraModal(modal) ? getOrchestraTitle(modal) : getBuyCryptoTitle(modal);

const HANDOFF_DELAY_MS = 260;

const TITLE_ICON_STYLE = { width: 24, height: 24, borderRadius: 12 };

/** Card deposits from a connected wallet are USDC-only. */
const CONNECTED_WALLET_TOKEN = 'USDC';

/**
 * "Choose a network" for the connected-wallet send: the chains the form can send
 * USDC on, and of those only the ones with an address — Fuse's own, and those
 * rhino.fi has a card route from. While rhino.fi's routes are not in, or when
 * they cannot be had, a loader or a retry stands in for them.
 */
const CardWalletNetworks = ({
  onSelect,
  supportedChainIds,
}: {
  onSelect: (chainId: number) => void;
  supportedChainIds: number[];
}) => {
  const networks = useMemo(
    () =>
      Object.entries(BRIDGE_TOKENS)
        .sort((a, b) => a[1].sort - b[1].sort)
        .map(([id, network]) => ({ chainId: Number(id), network }))
        .filter(({ chainId }) => supportedChainIds.includes(chainId))
        .filter(({ chainId }) =>
          getAllowedTokensForChain(chainId).includes(CONNECTED_WALLET_TOKEN),
        ),
    [supportedChainIds],
  );
  const { rows, retry } = useRhinoNetworkRows(
    {
      destinationType: getCardFundRhinoDestination(CONNECTED_WALLET_TOKEN, CardProvider.RAIN),
      symbol: CONNECTED_WALLET_TOKEN,
    },
    networks,
  );
  const offered = rows.filter(({ state }) => isOfferedRhinoRow(state));
  const notice = getRhinoListNotice(rows.map(({ state }) => state));

  return (
    <View className="min-h-[33rem] gap-y-2">
      <Text className="text-[1rem] font-medium text-muted-foreground">Choose a network</Text>
      <View className="gap-y-1.5">
        {offered.map(({ row: { chainId, network } }) => {
          const estimatedDesc =
            chainId === 1 ? 'Estimated speed: 5 min' : 'Estimated speed: 20 min';
          return (
            <DepositNetwork
              key={network.name}
              name={network.name}
              description={estimatedDesc}
              icon={network.icon}
              isComingSoon={network.isComingSoon}
              onPress={() => onSelect(chainId)}
            />
          );
        })}
        {notice ? (
          <RhinoNetworksNotice
            notice={notice}
            symbol={CONNECTED_WALLET_TOKEN}
            hasRows={offered.length > 0}
            onRetry={retry}
            className="rounded-[15px] bg-card"
          />
        ) : null}
      </View>
    </View>
  );
};

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
  const [buyCryptoModal, setBuyCryptoModal] = useState<DepositModal | null>(null);
  // Token + chain picked in the direct-deposit flow (Stablecoins section).
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(undefined);
  // Deposit address fetched after chain selection (both the direct-deposit and
  // the connected-wallet paths send to the same session wallet).
  const [depositAddress, setDepositAddress] = useState<string | undefined>(undefined);
  // Set when a row rhino.fi serves was picked: the address step shows its address.
  const [rhinoSelection, setRhinoSelection] = useState<RhinoDepositSelection | undefined>(
    undefined,
  );
  const rhinoAssets = useOfferedRhinoDepositAssets();
  // The connected-wallet send form's destination, when the chain picked for it
  // is one rhino.fi serves: the transfer goes to the user's rhino.fi address.
  const [walletRhinoSelection, setWalletRhinoSelection] = useState<
    RhinoDepositSelection | undefined
  >(undefined);
  const {
    address: walletRhinoAddress,
    isError: hasWalletRhinoAddressError,
    isFetching: isFetchingWalletRhinoAddress,
    refetch: refetchWalletRhinoAddress,
  } = useRhinoDepositAddress(walletRhinoSelection);

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
      withRefreshToken(() =>
        createDirectDepositSession(chainId, token, CARD_FUND_DESTINATION_TYPE),
      ),
    onSuccess: data => {
      if (data?.walletAddress) setDepositAddress(data.walletAddress);
    },
  });

  const baseModal = MODAL_STATES[stepState.current];
  const currentModal = buyCryptoModal ?? baseModal;
  const currentModalRef = useRef<ModalState>(currentModal);
  currentModalRef.current = currentModal;

  const goToStep = useCallback((nextStep: Step) => {
    setBuyCryptoModal(null);
    setStepState({ current: nextStep, previous: currentModalRef.current });
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && walletConnectingRef.current) return;
      if (!isControlled) setIsOpenState(open);
      onOpenChange?.(open);
      if (!open) {
        setIsVirtualAccountApplyOpen(false);
        setStepState({ current: 'options', previous: CLOSE_STATE });
        setBuyCryptoModal(null);
        setDepositAddress(undefined);
        setSelectedChainId(undefined);
        setRhinoSelection(undefined);
        setWalletRhinoSelection(undefined);
      }
    },
    [isControlled, onOpenChange],
  );

  const navigateBuyCrypto = useCallback(
    (nextModal: DepositModal) => {
      const target = getEmbeddedBuyCryptoTarget(nextModal);
      if (target === 'close') {
        handleOpenChange(false);
        return;
      }
      if (target === 'entry') {
        goToStep('options');
        return;
      }
      setStepState(prev => ({ ...prev, previous: currentModalRef.current }));
      setBuyCryptoModal(target);
    },
    [goToStep, handleOpenChange],
  );
  const { handleBuyCryptoPress } = useBuyCryptoEntry(navigateBuyCrypto);
  // Cash App reuses the embedded-flow machinery: its steps are DepositModal
  // values too, and navigateBuyCrypto already maps CLOSE and OPEN_OPTIONS onto
  // this modal's own actions.
  const { openCashApp, isAvailable: isCashAppAvailable } = useOrchestraCardEntry(navigateBuyCrypto);
  // Onramper's Credit card row is for whitelisted users only.
  const hasCreditCard = useHasFeature('onramper');

  useEffect(
    () => () => {
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
    },
    [],
  );

  // USD lists its methods — the bank rail, Cash App where it is offered, and
  // Apple Pay — as the wallet's cash flow does, rather than going straight to
  // the bank rail.
  const handleUsdPress = useCallback(() => goToStep('usdMethods'), [goToStep]);

  // First-time setup stacks above this funding dialog so closing it returns here.
  // Existing accounts still hand off to the global details flow.
  const handleBankTransferPress = useCallback(() => {
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
  // buy-crypto steps replace this modal's content without closing its shell.
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

      void handleBuyCryptoPress();
    },
    [handleBuyCryptoPress, resetTransfi, setTransfiCurrency],
  );

  // Onramper's hosted widget, rendered inside this modal by the same embedded
  // navigator the TransFi screens use — so its title comes from
  // lib/buyCryptoFlow, not from a step of our own.
  const handleApplePayPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'buy_crypto',
      provider: 'onramper',
      currency: 'USD',
    });
    navigateBuyCrypto(DEPOSIT_MODAL.OPEN_ONRAMPER_WIDGET);
  }, [navigateBuyCrypto]);

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
      setRhinoSelection(undefined);
      goToStep('networks');
    },
    [goToStep],
  );

  // Direct-deposit path: pick the chain the stablecoin is sent from.
  // rhino.fi on every row but Base's and Fuse's: a row it has a card route from
  // shows the rhino.fi address, and only an own row (Base, where rhino.fi pays
  // the card out, and Fuse) mints a direct-deposit session. The list offers
  // nothing else, and nothing else is acted on here either.
  const handleDirectNetworkSelect = useCallback(
    (chainId: number) => {
      const row = resolveRhinoRow(rhinoAssets, {
        chainId,
        destinationType: getCardFundRhinoDestination(selectedToken, CardProvider.RAIN),
        symbol: selectedToken,
      });
      if (!isOfferedRhinoRow(row)) return;

      track(TRACKING_EVENTS.NETWORK_SELECTED, {
        chain_id: chainId,
        network_name: BRIDGE_TOKENS[chainId]?.name,
        token_symbol: selectedToken,
        deposit_type: 'card_direct_deposit',
        via_rhino: row.kind === 'rhino',
      });

      setRhinoSelection(row.kind === 'rhino' ? row.selection : undefined);
      setSelectedChainId(chainId);
      setDepositAddress(undefined);
      if (row.kind === 'own') prepareSession({ chainId, token: selectedToken });
      goToStep('address');
    },
    [goToStep, prepareSession, rhinoAssets, selectedToken],
  );

  // A "More networks" chain from under the list. Its address step fetches the
  // user's rhino.fi address itself, so no direct-deposit session is minted.
  const handleRhinoNetworkSelect = useCallback(
    (selection: RhinoDepositSelection) => {
      setSelectedChainId(undefined);
      setDepositAddress(undefined);
      setRhinoSelection(selection);
      goToStep('address');
    },
    [goToStep],
  );

  // Connected-wallet path only — navigates to the send form, whose destination
  // is the address a USDC row on that chain shows: rhino.fi's off Fuse (a plain
  // ERC-20 transfer from the connected wallet, which rhino.fi detects like any
  // other), our own session on Fuse. The list offers nothing else.
  const handleWalletNetworkSelect = useCallback(
    (chainId: number) => {
      const row = resolveRhinoRow(rhinoAssets, {
        chainId,
        destinationType: getCardFundRhinoDestination(CONNECTED_WALLET_TOKEN, CardProvider.RAIN),
        symbol: CONNECTED_WALLET_TOKEN,
      });
      if (!isOfferedRhinoRow(row)) return;

      const network = BRIDGE_TOKENS[chainId];

      track(TRACKING_EVENTS.NETWORK_SELECTED, {
        chain_id: chainId,
        network_name: network?.name,
        deposit_type: 'card_direct_deposit',
        via_rhino: row.kind === 'rhino',
      });

      setSrcChainId(chainId);
      setPrincipalToken(CONNECTED_WALLET_TOKEN);

      setDepositAddress(undefined);
      setWalletRhinoSelection(row.kind === 'rhino' ? row.selection : undefined);
      if (row.kind === 'own') prepareSession({ chainId, token: CONNECTED_WALLET_TOKEN });

      goToStep('form');
    },
    [rhinoAssets, setSrcChainId, setPrincipalToken, goToStep, prepareSession],
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
    if (buyCryptoModal) {
      const target = getEmbeddedBackTarget(buyCryptoModal);
      if (target === 'entry') {
        // The widget and Cash App are opened from the USD methods; the TransFi
        // screens from the options themselves.
        const isUsdMethod =
          buyCryptoModal.name === DEPOSIT_MODAL.OPEN_ONRAMPER_WIDGET.name ||
          isOrchestraModal(buyCryptoModal);
        goToStep(isUsdMethod ? 'usdMethods' : 'options');
      } else if (target) {
        navigateBuyCrypto(target);
      }
      return;
    }
    setStepState(prev => {
      const backStep: Step = (() => {
        if (prev.current === 'address') return 'networks';
        if (prev.current === 'form') return 'walletNetworks';
        return 'options';
      })();
      return { current: backStep, previous: MODAL_STATES[prev.current] };
    });
  }, [buyCryptoModal, goToStep, navigateBuyCrypto]);

  const { current: step, previous: previousModal } = stepState;
  const canGoBack = buyCryptoModal
    ? getEmbeddedBackTarget(buyCryptoModal) !== null
    : step !== 'options';

  const title = (() => {
    if (buyCryptoModal) return getEmbeddedTitle(buyCryptoModal);
    if (step === 'usdMethods') return 'Deposit US Dollars';
    if (step === 'networks') return selectedToken;
    if (step === 'address') return `Deposit ${selectedToken}`;
    return 'Fund your card';
  })();

  const titleIcon =
    !buyCryptoModal && (step === 'networks' || step === 'address') ? (
      <Image
        source={getCardFundTokenIcon(selectedToken)}
        style={TITLE_ICON_STYLE}
        contentFit="cover"
      />
    ) : undefined;

  const content = (() => {
    if (buyCryptoModal) {
      return isOrchestraModal(buyCryptoModal) ? (
        <OrchestraFlowContent modal={buyCryptoModal} navigate={navigateBuyCrypto} />
      ) : (
        <BuyCryptoFlowContent modal={buyCryptoModal} navigate={navigateBuyCrypto} />
      );
    }
    if (step === 'options') {
      return (
        <CardFundOptions
          onTokenPress={handleTokenPress}
          onMoveFromSavingsPress={handleTransferFromWallet}
          onExternalWalletPress={handleConnectWallet}
          onUsdPress={handleUsdPress}
          isCashAppAvailable={isCashAppAvailable}
          isCreditCardAvailable={hasCreditCard}
          onLocalCurrencyPress={handleLocalCurrencyPress}
          isExternalWalletLoading={isWalletOpen}
        />
      );
    }

    if (step === 'usdMethods') {
      return (
        <UsdMethodList
          onBankTransferPress={handleBankTransferPress}
          onCashAppPress={isCashAppAvailable ? openCashApp : undefined}
          onApplePayPress={hasCreditCard ? handleApplePayPress : undefined}
        />
      );
    }

    if (step === 'networks') {
      return (
        <CardFundNetworks
          symbol={selectedToken}
          cardProvider={CardProvider.RAIN}
          onSelect={handleDirectNetworkSelect}
          onSelectRhino={handleRhinoNetworkSelect}
        />
      );
    }

    if (step === 'address' && rhinoSelection) {
      return (
        <RhinoDepositAddress
          selection={rhinoSelection}
          onChangeNetwork={handleBack}
          onDepositDetected={handleDepositDetected}
        />
      );
    }

    if (step === 'address') {
      return (
        <CardFundDepositAddress
          address={depositAddress}
          symbol={selectedToken}
          chainId={selectedChainId ?? 0}
          cardProvider={CardProvider.RAIN}
          onChangeNetwork={handleBack}
          onDepositDetected={handleDepositDetected}
        />
      );
    }

    if (step === 'walletNetworks') {
      return (
        <CardWalletNetworks
          onSelect={handleWalletNetworkSelect}
          supportedChainIds={depositConfig.supportedChains}
        />
      );
    }

    if (step === 'form') {
      // rhino.fi's address for the chain picked, or our own session on Fuse.
      const destinationAddress = walletRhinoSelection
        ? walletRhinoAddress?.depositAddress
        : depositAddress;
      if (walletRhinoSelection && hasWalletRhinoAddressError && !isFetchingWalletRhinoAddress) {
        return (
          <View className="items-center gap-y-3 py-12">
            <Text className="text-center text-sm text-white/70">
              Could not load the deposit address.
            </Text>
            <Button
              variant="secondary"
              className="h-10 rounded-full px-6"
              onPress={() => void refetchWalletRhinoAddress()}
            >
              <Text className="text-sm font-semibold">Try again</Text>
            </Button>
          </View>
        );
      }
      // rhino.fi turns a deposit under its floor away, so the form never asks
      // for less than that floor, or the card's own.
      const rhinoMinimumUsd = walletRhinoSelection
        ? (walletRhinoAddress?.minimumUsd ??
          findRhinoRoute(rhinoAssets.assets, walletRhinoSelection)?.route.minimumUsd)
        : undefined;
      const minDeposit =
        rhinoMinimumUsd !== undefined &&
        rhinoMinimumUsd > Number(EXPO_PUBLIC_MINIMUM_CARD_DEPOSIT_AMOUNT)
          ? String(rhinoMinimumUsd)
          : EXPO_PUBLIC_MINIMUM_CARD_DEPOSIT_AMOUNT;
      return destinationAddress ? (
        <AddFundsToWalletForm
          destinationAddress={destinationAddress}
          minDeposit={minDeposit}
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
        contentKey={buyCryptoModal?.name ?? step}
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
