import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageSourcePropType, Pressable, ScrollView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { type Href, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { base } from 'viem/chains';

import DepositScanningIndicator from '@/components/Card/CardFund/DepositScanningIndicator';
import CopyToClipboard from '@/components/CopyToClipboard';
import DepositAddressInstructions, {
  RhinoWalletDepositInstructions,
} from '@/components/DepositOption/DepositAddressInstructions';
import DepositFeeNotice from '@/components/DepositOption/DepositFeeNotice';
import { getRhinoChainIcon } from '@/components/DepositOption/RhinoDeposit/RhinoChainIcon';
import RhinoDepositDetails from '@/components/DepositOption/RhinoDeposit/RhinoDepositDetails';
import RhinoDepositStatus from '@/components/DepositOption/RhinoDeposit/RhinoDepositStatus';
import { useRhinoAddressAnalytics } from '@/components/DepositOption/RhinoDeposit/useRhinoAddressAnalytics';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDepositAssets } from '@/hooks/useDepositAssets';
import { useDetectedBaseSafeDeposit } from '@/hooks/useDetectedBaseSafeDeposit';
import { useDetectedDirectDeposit } from '@/hooks/useDetectedDirectDeposit';
import { useEuroSpendEnablement } from '@/hooks/useEuroSpendEnablement';
import { useRhinoDepositAddress } from '@/hooks/useRhinoDepositAddress';
import { useOfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';
import { useWalletDepositAddress } from '@/hooks/useWalletDepositAddress';
import { track } from '@/lib/analytics';
import { isNativeHelpEnabled, openHelpLink } from '@/lib/help/links';
import { findRhinoRoute, formatDepositAddress } from '@/lib/rhinoDeposit';
import { DetectedDirectDepositResponse } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

import {
  formatWalletDepositMinimum,
  getDefaultWalletDepositSelection,
  getWalletDepositExtraRow,
  getWalletDepositNetworks,
  getWalletDepositRow,
  getWalletDepositTokenIcon,
  resolveWalletDepositChain,
  resolveWalletDepositExtraChain,
  resolveWalletDepositMinimum,
  resolveWalletDepositSymbol,
  WALLET_DEPOSIT_LEARN_URL,
} from './constants';
import { useWalletDepositViewer } from './useWalletDepositViewer';
import WalletDepositSelectors, { WalletDepositNetworkList } from './WalletDepositSelectors';

/** Design caps the QR at 259px; below that it tracks the card width. */
const QR_MAX_SIZE = 259;
/** Inset shared by both halves of the card, so the QR and address line up. */
const CARD_PADDING = 20;
/**
 * Margin of plain background left around the modules. The library keeps the
 * element at `size` and scales the modules down to make room, so this buys the
 * 20px corner radius something to cut into: a radius R bites at most R - R/√2
 * (≈ 5.9px here) into the corner, well inside the ~9px margin, which keeps the
 * rounding clear of the finder patterns a scanner needs intact.
 */
const QR_QUIET_ZONE = 10;
const INLINE_ICON_STYLE = { width: 16, height: 16, borderRadius: 8 };
const BELOW_MINIMUM_WARNING = 'Deposits below the minimum will not be credited or refunded';

/** In the QR's place when its address cannot be had: why, and a retry. */
const AddressRetry = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <View className="items-center gap-y-3 px-6">
    <Text className="text-center text-sm text-white/70">{message}</Text>
    <Button variant="secondary" className="h-10 rounded-full px-6" onPress={onRetry}>
      <Text className="text-sm font-semibold">Try again</Text>
    </Button>
  </View>
);

/**
 * "Deposit Address" — where a crypto deposit into the wallet is sent.
 *
 * Which address depends on the row (see `getWalletDepositRow`):
 *
 * - Every row but Base's and Fuse's is rhino.fi's: the user's rhino.fi address
 *   for the currency, paying the Safe on Base, a Wirex cardholder's included
 *   (USDT arrives as USDC). If it cannot be had, the screen says so and offers
 *   a retry; it never hands out an address of ours instead.
 * - Base, where rhino.fi pays out, is ours: the Safe, where the currency lands
 *   as sent, or for ETH our wallet deposit address, which wraps it (see
 *   `getWalletOwnAddress`).
 * - Fuse is the Safe, or a Wirex cardholder's minted address, as it always was.
 * - A "More networks" chain (`rhinoChain`: Tron, Solana, …) is rhino.fi's
 *   address for it, drawn with rhino.fi's name for the chain.
 * - While the backend has rhino.fi off, every row is ours: the Safe on Base and
 *   Fuse, and a minted address for USDC and USDT on the chains our pipeline
 *   bridges them to Base from. There is no retry: nothing has failed.
 *
 * Until rhino.fi's routes are in no row but Fuse's can be told apart, so the QR
 * waits; if they cannot be had, it offers a retry. Sending a currency the chosen
 * chain does not list, or less than its minimum, is what the copy under the QR
 * is there to prevent.
 */
const WalletDepositAddress = () => {
  // Chain and currency are both chosen on steps of their own, so the selection
  // lives in the store rather than here (see `walletDeposit`). This screen only
  // reads it.
  const walletDeposit = useDepositStore(state => state.walletDeposit);
  const setWalletDeposit = useDepositStore(state => state.setWalletDeposit);
  const fallback = useMemo(() => getDefaultWalletDepositSelection(), []);
  const chainId = walletDeposit.chainId ?? fallback.chainId;
  const symbol = walletDeposit.symbol ?? fallback.symbol;
  const { rhinoChain } = walletDeposit;
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState(QR_MAX_SIZE);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const hasOpenedActivity = useRef(false);
  const { bottom } = useSafeAreaInsets();

  const network = useMemo(
    () => getWalletDepositNetworks().find(item => item.chainId === chainId),
    [chainId],
  );

  // Who this is for, and rhino.fi's routes: together they decide the row.
  const viewer = useWalletDepositViewer();
  // Wirex cardholders and people with no card both land here. A minted wallet
  // address is charged the same for both; a Wirex cardholder's card address on
  // Fuse is priced as their card — see `getDepositFeeRatePpm`.
  const { provider } = viewer;
  const { retry: retryRhinoAssets } = useOfferedRhinoDepositAssets();

  const row = useMemo(
    () =>
      rhinoChain
        ? getWalletDepositExtraRow(rhinoChain, symbol, viewer)
        : getWalletDepositRow(chainId, symbol, viewer),
    [chainId, rhinoChain, symbol, viewer],
  );
  const rhinoSelection = row.kind === 'rhino' ? row.selection : undefined;
  const rhino = useMemo(
    () => (rhinoSelection ? findRhinoRoute(viewer.rhino?.assets, rhinoSelection) : undefined),
    [rhinoSelection, viewer.rhino?.assets],
  );
  const {
    address: rhinoAddress,
    isError: hasRhinoAddressError,
    isFetching: isFetchingRhinoAddress,
    refetch: refetchRhinoAddress,
  } = useRhinoDepositAddress(rhinoSelection);
  const trackRhinoCopy = useRhinoAddressAnalytics(rhinoSelection, rhinoAddress?.depositAddress);
  // A "More networks" chain is one the list has no row for, drawn as rhino.fi names it.
  const extraChain = rhinoChain ? rhino?.chain : undefined;

  // A pairing that is not a row for this user — rhino.fi has no route for it, or
  // a caller opened it on a chain of its own (Main currency) — moves to
  // one that is, as "Select token" would have picked: the same currency on
  // another chain, else what that chain does carry.
  // Fixed Safe deposits keep their original token and network.
  const correction = useMemo(() => {
    if (row.kind !== 'none' || walletDeposit.toSafe) return undefined;
    // A "More networks" chain that no longer takes the currency: back to the row.
    if (rhinoChain) return { rhinoChain: undefined };
    // A currency only "More networks" carries (native BTC): its first chain there.
    const extraChain = resolveWalletDepositExtraChain(symbol, undefined, viewer);
    if (extraChain) return { rhinoChain: extraChain };
    const nextChainId = resolveWalletDepositChain(symbol, chainId, viewer);
    const nextSymbol = resolveWalletDepositSymbol(nextChainId, symbol, viewer) ?? symbol;
    return nextChainId !== chainId || nextSymbol !== symbol
      ? { chainId: nextChainId, symbol: nextSymbol }
      : undefined;
  }, [chainId, rhinoChain, row.kind, symbol, viewer, walletDeposit.toSafe]);
  useEffect(() => {
    if (correction) setWalletDeposit(correction);
  }, [correction, setWalletDeposit]);

  // Our own address, for our own rows only: the Safe, or an address the
  // pipeline mints and watches (a Wirex cardholder's dollars on Fuse, and
  // dollars off Base while rhino.fi is off).
  const {
    address: walletAddress,
    isError: hasWalletAddressError,
    isMinted,
    sessionDestination,
  } = useWalletDepositAddress(chainId, symbol, {
    enabled: row.kind === 'own',
    rhinoOff: viewer.rhino?.status === 'disabled',
    // A flow funding the Safe itself (the AI API) asks for the Safe outright.
    toSafe: walletDeposit.toSafe,
  });
  const address =
    row.kind === 'rhino'
      ? rhinoAddress?.depositAddress
      : row.kind === 'own'
        ? walletAddress
        : undefined;
  const networkUnavailable = row.kind === 'unavailable';
  const showRhinoAddressError =
    row.kind === 'rhino' && hasRhinoAddressError && !isFetchingRhinoAddress;
  const showWalletAddressError = row.kind === 'own' && hasWalletAddressError;
  const unsupportedSelection = row.kind === 'none' && !correction;
  const isAddressLoading =
    !address &&
    !networkUnavailable &&
    !showRhinoAddressError &&
    !showWalletAddressError &&
    !unsupportedSelection;
  const qrLogo = extraChain
    ? getRhinoChainIcon(extraChain.chain, extraChain.chainId)
    : network?.icon;
  // A row keeps the name it has in the list ("Polygon", not rhino.fi's own); a
  // "More networks" chain has only rhino.fi's.
  const rhinoChainName = extraChain ? extraChain.name : (network?.name ?? rhino?.chain.name);
  const tokenIcon = getWalletDepositTokenIcon(symbol);
  // The pipeline's own floor when it has answered, the committed estimate until
  // then — never a blank, which is the one thing this line must not show.
  const { data: depositAssets } = useDepositAssets();
  const publishedAssets = useMemo(
    () => depositAssets && [...depositAssets.assets, ...(depositAssets.walletAssets ?? [])],
    [depositAssets],
  );
  const minimum = resolveWalletDepositMinimum(chainId, symbol, publishedAssets);
  const usesCompactRhinoDetails =
    rhinoSelection?.destinationType === 'WALLET' && !walletDeposit.toSafe;
  const rhinoDetails = rhino &&
    rhinoSelection && {
      tokenSymbol: symbol,
      chain: rhino.chain.chain,
      chainName: rhinoChainName ?? rhino.chain.name,
      destinationType: rhinoSelection.destinationType,
      receiveSymbol: rhinoAddress?.receiveSymbol ?? rhino.route.receiveSymbol,
      receiveChainId: rhinoAddress?.receiveChainId ?? rhino.route.receiveChainId,
      minimumUsd: rhinoAddress?.minimumUsd ?? rhino.route.minimumUsd,
      maximumUsd: rhinoAddress?.maximumUsd ?? rhino.route.maximumUsd,
    };
  const usesCompactDirectDetails =
    row.kind === 'own' && chainId === base.id && !isMinted && !walletDeposit.toSafe && !!network;
  // EURC lands in the Safe on Base, where the card can only pay with it once it is turned on in
  // Main currency — said here, before the deposit, rather than by the first declined payment.
  const euroSpend = useEuroSpendEnablement();
  const showsEuroSpendingNote =
    (rhino ? rhino.route.receiveSymbol : symbol) === 'EURC' && euroSpend.shouldOffer;
  const router = useRouter();
  const setDepositModal = useDepositStore(state => state.setModal);
  const openDepositHelp = () => {
    if (isNativeHelpEnabled()) setDepositModal(DEPOSIT_MODAL.CLOSE);
    openHelpLink(WALLET_DEPOSIT_LEARN_URL);
  };
  const openMainCurrency = useCallback(() => {
    setDepositModal(DEPOSIT_MODAL.CLOSE);
    router.push(path.CARD_MAIN_CURRENCY);
  }, [router, setDepositModal]);

  const watchesDirectSession = !!address && isMinted && row.kind === 'own';
  // A completed Rhino payout or a confirmed Safe receipt opens the feed.
  // A tracked deposit session opens its own progress screen.
  const openDepositActivity = useCallback(
    (href: Href = path.ACTIVITY) => {
      if (hasOpenedActivity.current) return;
      hasOpenedActivity.current = true;
      setDepositModal(DEPOSIT_MODAL.CLOSE);
      router.push(href);
    },
    [router, setDepositModal],
  );
  const baseSafeSymbol =
    row.kind === 'own' &&
    !isMinted &&
    !walletDeposit.toSafe &&
    chainId === base.id &&
    (symbol === 'USDC' || symbol === 'EURC')
      ? symbol
      : undefined;
  const safeDeposit = useDetectedBaseSafeDeposit({
    address: baseSafeSymbol ? address : undefined,
    symbol: baseSafeSymbol,
    onDetected: openDepositActivity,
  });
  // The pipeline has seen the transfer: hand the user to its progress screen, as the
  // card deposit sheet does. Polling stops at detection, so staying here would leave
  // "Deposit detected" spinning with nothing ever coming after it.
  const openDetectedDeposit = useCallback(
    (deposit: DetectedDirectDepositResponse) => {
      if (deposit.clientTxId) openDepositActivity(`/activity/${deposit.clientTxId}`);
    },
    [openDepositActivity],
  );
  // rhino.fi pays ETH out as ETH to the user's wallet deposit address on Base,
  // where the pipeline wraps it into WETH for the Safe: watched like a minted
  // address, so the deposit's progress opens once that payout lands, as the
  // card and savings screens do for theirs. Every other wallet route pays the
  // Safe itself, which the pipeline does not watch.
  const watchesRhinoPayout =
    row.kind === 'rhino' &&
    !!rhinoAddress &&
    rhinoSelection?.destinationType === 'WALLET' &&
    (rhinoAddress.receiveSymbol ?? rhino?.route.receiveSymbol) === 'ETH';
  const { isDetected } = useDetectedDirectDeposit({
    enabled: watchesDirectSession || watchesRhinoPayout,
    destinationType: watchesRhinoPayout ? 'WALLET' : sessionDestination,
    onDetected: openDetectedDeposit,
  });

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    if (rhino) trackRhinoCopy();
  }, [address, rhino, trackRhinoCopy]);

  // The list only offers chains carrying the current currency, so this should
  // never have to change it — resolved anyway rather than trusting that.
  const handleSelectNetwork = useCallback(
    (nextChainId: number) => {
      setWalletDeposit({
        chainId: nextChainId,
        symbol: resolveWalletDepositSymbol(nextChainId, symbol, viewer) ?? symbol,
      });
      setIsNetworkOpen(false);
    },
    [setWalletDeposit, symbol, viewer],
  );

  // The list only offers "More networks" chains taking the current currency
  // into the wallet, so the currency stays as it is.
  const handleSelectExtraNetwork = useCallback(
    (chain: string) => {
      track(TRACKING_EVENTS.DEPOSIT_RHINO_NETWORK_SELECTED, {
        deposit_method: 'rhino_deposit_address',
        destination_type: 'WALLET',
        rhino_chain: chain,
        network_name: viewer.rhino?.assets?.chains?.find(item => item.chain === chain)?.name,
        token_symbol: symbol,
      });
      setWalletDeposit({ rhinoChain: chain });
      setIsNetworkOpen(false);
    },
    [setWalletDeposit, symbol, viewer.rhino?.assets],
  );

  const addressContent = (
    <View className="gap-y-6">
      <WalletDepositSelectors
        chainId={chainId}
        symbol={symbol}
        extraChain={extraChain}
        isNetworkOpen={isNetworkOpen}
        onToggleNetwork={() => setIsNetworkOpen(open => !open)}
        // Funding the Safe for the AI API takes its billing currency on its
        // billing chain; the Safe anywhere else would not fund it.
        isLocked={!!walletDeposit.toSafe}
      />

      {/* The card's own padding sits on each section rather than the card, so the
          divider between the QR and the address runs its full width. */}
      <View
        className="overflow-hidden rounded-[20px] bg-card"
        accessible={isAddressLoading || undefined}
        accessibilityLabel={isAddressLoading ? 'Loading deposit address' : undefined}
        accessibilityState={isAddressLoading ? { busy: true } : undefined}
      >
        <View
          className="w-full items-center"
          style={{ padding: CARD_PADDING }}
          onLayout={event =>
            setQrSize(
              Math.min(Math.round(event.nativeEvent.layout.width) - CARD_PADDING * 2, QR_MAX_SIZE),
            )
          }
        >
          <View
            className="items-center justify-center overflow-hidden rounded-[20px]"
            style={{ width: qrSize, height: qrSize }}
          >
            {networkUnavailable ? (
              <AddressRetry message="Couldn’t load this network." onRetry={retryRhinoAssets} />
            ) : showRhinoAddressError ? (
              <AddressRetry
                message="Could not load the deposit address."
                onRetry={() => void refetchRhinoAddress()}
              />
            ) : showWalletAddressError ? (
              <Text className="px-6 text-center text-sm text-white/70">
                Could not load the deposit address. Close and try again.
              </Text>
            ) : unsupportedSelection ? (
              <Text className="px-6 text-center text-sm text-white/70">
                {`${symbol} can’t be deposited on ${network?.name ?? 'this network'} right now.`}
              </Text>
            ) : address ? (
              <QRCode
                value={address}
                size={qrSize}
                color="white"
                backgroundColor="#1C1C1C"
                // Keeps the rounded corners clear of the finder patterns: a corner
                // clipped into is a corner a scanner can fail to locate.
                quietZone={QR_QUIET_ZONE}
                logo={qrLogo as ImageSourcePropType | undefined}
                logoSize={Math.round(qrSize * 0.154)}
                logoBorderRadius={Math.round(qrSize * 0.077)}
                logoBackgroundColor="transparent"
              />
            ) : (
              <Skeleton className="h-full w-full rounded-[20px] bg-white/[0.08]" />
            )}
          </View>
        </View>

        <View className="h-px bg-white/[0.08]" />

        <View
          className="flex-row items-center justify-center"
          style={{ paddingHorizontal: CARD_PADDING, paddingVertical: CARD_PADDING * 0.75 }}
        >
          {isAddressLoading ? (
            <View className="h-8 justify-center">
              <Skeleton className="h-5 w-36 bg-white/[0.08]" />
            </View>
          ) : (
            <>
              {/* Shortened from both ends even for non-EVM addresses. */}
              <Text className="text-lg font-medium text-white">
                {address ? formatDepositAddress(address, 7, 5) : '—'}
              </Text>
              {address ? (
                <CopyToClipboard
                  text={address}
                  className="h-8 w-8 bg-transparent web:hover:bg-transparent web:active:bg-transparent"
                  iconClassName="text-white"
                  onCopy={rhino ? trackRhinoCopy : undefined}
                />
              ) : null}
            </>
          )}
        </View>
      </View>

      <View className="gap-y-3">
        {rhinoDetails ? (
          usesCompactRhinoDetails ? (
            <RhinoWalletDepositInstructions {...rhinoDetails} onLearnMore={openDepositHelp} />
          ) : (
            <RhinoDepositDetails {...rhinoDetails} />
          )
        ) : usesCompactDirectDetails ? (
          <DepositAddressInstructions
            tokenSymbol={symbol}
            chainName={network.name}
            summary={`Min ${formatWalletDepositMinimum(minimum)} ${symbol}`}
            amountWarning={BELOW_MINIMUM_WARNING}
            onLearnMore={openDepositHelp}
          />
        ) : row.kind === 'own' ? (
          <>
            <View className="flex-row flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
              <Text className="text-base font-medium text-white">Send at least</Text>
              <Image source={tokenIcon} style={INLINE_ICON_STYLE} contentFit="cover" />
              {/* "10 USDC", "0.005 ETH" and "0.00012 WBTC" all read right, rounded up. */}
              <Text className="text-base font-medium text-white">{`${formatWalletDepositMinimum(minimum)} ${symbol} on the`}</Text>
              {network?.icon ? (
                <Image source={network.icon} style={INLINE_ICON_STYLE} contentFit="cover" />
              ) : null}
              <Text className="text-base font-medium text-white">{`${network?.name ?? ''} chain to this address`}</Text>
            </View>
            <Text className="text-center text-sm text-white/50">{BELOW_MINIMUM_WARNING}</Text>
          </>
        ) : null}
        {showsEuroSpendingNote ? (
          <View className="flex-row flex-wrap items-center justify-center gap-x-1">
            <Text className="text-center text-sm text-white/70">
              Set euro as your main currency to pay in euros.
            </Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Main currency"
              onPress={openMainCurrency}
              hitSlop={8}
              className="web:hover:opacity-70"
            >
              <Text className="text-sm font-semibold text-brand underline">Main currency</Text>
            </Pressable>
          </View>
        ) : null}
        {/* rhino.fi payouts pay no Solid deposit fee, and nor does a transfer
            straight to the Safe: only an address the pipeline mints is charged. */}
        {row.kind === 'own' && isMinted ? (
          <DepositFeeNotice
            product="wallet"
            provider={provider}
            chainId={chainId}
            symbol={symbol}
            walletAddress={sessionDestination}
            className="mt-2"
          />
        ) : null}
        {!usesCompactRhinoDetails && !usesCompactDirectDetails ? (
          <Pressable
            className="flex-row items-center justify-center gap-x-1 web:hover:opacity-70"
            onPress={() => openHelpLink(WALLET_DEPOSIT_LEARN_URL)}
          >
            <Text className="text-sm text-white">Learn about deposits</Text>
            <ChevronRight color="white" size={16} />
          </Pressable>
        ) : null}
      </View>

      {rhino && rhinoSelection ? (
        <RhinoDepositStatus
          enabled={!!address}
          depositAddress={address}
          chain={rhino.chain.chain}
          chainName={rhinoChainName ?? rhino.chain.name}
          addressType={rhinoAddress?.addressType ?? rhino.chain.addressType}
          destinationType={rhinoSelection.destinationType}
          compact={usesCompactRhinoDetails}
          onComplete={openDepositActivity}
        />
      ) : null}

      {watchesDirectSession || safeDeposit.isWatching ? (
        <View className="flex-row items-center gap-x-2 self-center rounded-[18px] bg-[#333333] px-4 py-2">
          <Text className="text-sm leading-4 text-white">
            {isDetected || safeDeposit.isDetected ? 'Deposit detected' : 'Scanning for deposits'}
          </Text>
          <DepositScanningIndicator />
        </View>
      ) : null}

      {/* Last child, so paint order puts the open list over everything above. */}
      {isNetworkOpen && !walletDeposit.toSafe ? (
        <WalletDepositNetworkList
          chainId={chainId}
          symbol={symbol}
          rhinoChain={extraChain?.chain}
          onSelect={handleSelectNetwork}
          onSelectExtra={handleSelectExtraNetwork}
          onDismiss={() => setIsNetworkOpen(false)}
        />
      ) : null}
    </View>
  );

  return (
    <View className="min-h-0 flex-1">
      <ScrollView
        className="min-h-0 flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {addressContent}
      </ScrollView>
      <View className="shrink-0 pt-4" style={{ paddingBottom: 16 + bottom }}>
        <Button
          variant="brand"
          className="h-12 w-full rounded-full"
          onPress={handleCopy}
          disabled={!address || isNetworkOpen}
        >
          <Text className="text-base font-bold text-black">
            {copied ? 'Address copied' : 'Copy address'}
          </Text>
        </Button>
      </View>
    </View>
  );
};

export default WalletDepositAddress;
