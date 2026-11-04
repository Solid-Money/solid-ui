import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageSourcePropType, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import { CARD_FUND_DESTINATION_TYPE } from '@/components/Card/CardFund/constants';
import DepositScanningIndicator from '@/components/Card/CardFund/DepositScanningIndicator';
import CopyToClipboard from '@/components/CopyToClipboard';
import DepositFeeNotice from '@/components/DepositOption/DepositFeeNotice';
import RhinoDepositDetails from '@/components/DepositOption/RhinoDeposit/RhinoDepositDetails';
import RhinoDepositStatus from '@/components/DepositOption/RhinoDeposit/RhinoDepositStatus';
import { useRhinoAddressAnalytics } from '@/components/DepositOption/RhinoDeposit/useRhinoAddressAnalytics';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useDepositAssets } from '@/hooks/useDepositAssets';
import { useDetectedDirectDeposit } from '@/hooks/useDetectedDirectDeposit';
import { useEuroSpendEnablement } from '@/hooks/useEuroSpendEnablement';
import { useRhinoDepositAddress } from '@/hooks/useRhinoDepositAddress';
import { useOfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';
import { useWalletDepositAddress } from '@/hooks/useWalletDepositAddress';
import { openHelpLink } from '@/lib/help/links';
import { findRhinoRoute, formatDepositAddress } from '@/lib/rhinoDeposit';
import { DetectedDirectDepositResponse } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

import {
  formatWalletDepositMinimum,
  getDefaultWalletDepositSelection,
  getWalletDepositNetworks,
  getWalletDepositRow,
  getWalletDepositTokenIcon,
  resolveWalletDepositChain,
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
 * - Every row but Fuse's is rhino.fi's: the user's rhino.fi address for the
 *   currency, paying the Safe on Base (a Wirex cardholder's dollars: their card
 *   address, and from there the Safe on Fuse). If it cannot be had, the screen
 *   says so and offers a retry; it never hands out an address of ours instead.
 * - Fuse is the Safe, or a Wirex cardholder's minted address, as it always was.
 * - A currency rhino.fi takes on none of its rows is offered on Base alone, and
 *   there the address is the Safe, where it lands as sent.
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
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState(QR_MAX_SIZE);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);

  const network = useMemo(
    () => getWalletDepositNetworks().find(item => item.chainId === chainId),
    [chainId],
  );

  // Who this is for, and rhino.fi's routes: together they decide the row.
  const viewer = useWalletDepositViewer();
  // Wirex cardholders and people with no card both land here, and only the
  // cardholders are charged — see `getDepositFeeRatePpm`.
  const { provider } = viewer;
  const { retry: retryRhinoAssets } = useOfferedRhinoDepositAssets();

  const row = useMemo(
    () => getWalletDepositRow(chainId, symbol, viewer),
    [chainId, symbol, viewer],
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

  // A pairing that is not a row for this user — rhino.fi has no route for it, or
  // a caller opened it on a chain of its own (Main currency, AI API) — moves to
  // one that is, as "Select token" would have picked: the same currency on
  // another chain, else what that chain does carry.
  const correction = useMemo(() => {
    if (row.kind !== 'none') return undefined;
    const nextChainId = resolveWalletDepositChain(symbol, chainId, viewer);
    const nextSymbol = resolveWalletDepositSymbol(nextChainId, symbol, viewer) ?? symbol;
    return nextChainId !== chainId || nextSymbol !== symbol
      ? { chainId: nextChainId, symbol: nextSymbol }
      : undefined;
  }, [chainId, row.kind, symbol, viewer]);
  useEffect(() => {
    if (correction) setWalletDeposit(correction);
  }, [correction, setWalletDeposit]);

  // Our own address, for our own rows only: the Safe, or on Fuse a Wirex
  // cardholder's minted stablecoin address, which the pipeline watches.
  const {
    address: walletAddress,
    isError: hasWalletAddressError,
    isMinted,
  } = useWalletDepositAddress(chainId, symbol, { enabled: row.kind === 'own' });
  const address =
    row.kind === 'rhino'
      ? rhinoAddress?.depositAddress
      : row.kind === 'own'
        ? walletAddress
        : undefined;
  const qrLogo = network?.icon;
  // A row keeps the name it has in the list ("Polygon", not rhino.fi's own).
  const rhinoChainName = network?.name ?? rhino?.chain.name;
  const tokenIcon = getWalletDepositTokenIcon(symbol);
  // The pipeline's own floor when it has answered, the committed estimate until
  // then — never a blank, which is the one thing this line must not show.
  const { data: depositAssets } = useDepositAssets();
  const publishedAssets = useMemo(
    () => depositAssets && [...depositAssets.assets, ...(depositAssets.walletAssets ?? [])],
    [depositAssets],
  );
  const minimum = resolveWalletDepositMinimum(chainId, symbol, publishedAssets);
  // EURC lands in the Safe on Base, where the card can only pay with it once it is turned on in
  // Main currency — said here, before the deposit, rather than by the first declined payment.
  const euroSpend = useEuroSpendEnablement();
  const showsEuroSpendingNote =
    (rhino ? rhino.route.receiveSymbol : symbol) === 'EURC' && euroSpend.shouldOffer;
  const router = useRouter();
  const setDepositModal = useDepositStore(state => state.setModal);
  const openMainCurrency = useCallback(() => {
    setDepositModal(DEPOSIT_MODAL.CLOSE);
    router.push(path.CARD_MAIN_CURRENCY);
  }, [router, setDepositModal]);

  // Only a minted address is watched, so only then is there anything to scan for.
  // The Safe is not registered with the pipeline; saying "scanning" over it would
  // be describing a poll that can never come back positive.
  const isScanning = !!address && isMinted && row.kind === 'own';
  // A Wirex cardholder's dollars through rhino.fi are paid to their card address,
  // which the pipeline does watch: its detection hands them to the activity, as
  // on the card's own rhino.fi address step.
  const watchesRhinoCardPayout =
    !!address && rhinoSelection?.destinationType === CARD_FUND_DESTINATION_TYPE;
  // The pipeline has seen the transfer: hand the user to its progress screen, as the
  // card deposit sheet does. Polling stops at detection, so staying here would leave
  // "Deposit detected" spinning with nothing ever coming after it.
  const openDetectedDeposit = useCallback(
    (deposit: DetectedDirectDepositResponse) => {
      if (!deposit.clientTxId) return;
      setDepositModal(DEPOSIT_MODAL.CLOSE);
      router.push(`/activity/${deposit.clientTxId}`);
    },
    [router, setDepositModal],
  );
  const { isDetected } = useDetectedDirectDeposit({
    enabled: isScanning || watchesRhinoCardPayout,
    destinationType: CARD_FUND_DESTINATION_TYPE,
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

  return (
    <View className="gap-y-6">
      <WalletDepositSelectors
        chainId={chainId}
        symbol={symbol}
        isNetworkOpen={isNetworkOpen}
        onToggleNetwork={() => setIsNetworkOpen(open => !open)}
      />

      {/* The card's own padding sits on each section rather than the card, so the
          divider between the QR and the address runs its full width. */}
      <View className="overflow-hidden rounded-[20px] bg-card">
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
            {row.kind === 'unavailable' ? (
              <AddressRetry message="Couldn’t load this network." onRetry={retryRhinoAssets} />
            ) : row.kind === 'rhino' && hasRhinoAddressError && !isFetchingRhinoAddress ? (
              <AddressRetry
                message="Could not load the deposit address."
                onRetry={() => void refetchRhinoAddress()}
              />
            ) : row.kind === 'own' && hasWalletAddressError ? (
              <Text className="px-6 text-center text-sm text-white/70">
                Could not load the deposit address. Close and try again.
              </Text>
            ) : row.kind === 'none' && !correction ? (
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
              <ActivityIndicator color="white" />
            )}
          </View>
        </View>

        <View className="h-px bg-white/[0.08]" />

        <View
          className="flex-row items-center justify-center"
          style={{ paddingHorizontal: CARD_PADDING, paddingVertical: CARD_PADDING * 0.75 }}
        >
          {/* Shortened from both ends, whatever the format: a Tron or Solana
              address has no 0x and is not 42 characters. */}
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
        </View>
      </View>

      <View className="gap-y-3">
        {rhino && rhinoSelection ? (
          <RhinoDepositDetails
            tokenSymbol={symbol}
            chainName={rhinoChainName ?? rhino.chain.name}
            destinationType={rhinoSelection.destinationType}
            receiveSymbol={rhinoAddress?.receiveSymbol ?? rhino.route.receiveSymbol}
            receiveChainId={rhinoAddress?.receiveChainId ?? rhino.route.receiveChainId}
            minimumUsd={rhinoAddress?.minimumUsd ?? rhino.route.minimumUsd}
            maximumUsd={rhinoAddress?.maximumUsd ?? rhino.route.maximumUsd}
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
            <Text className="text-center text-sm text-white/50">
              Deposits below the minimum will not be credited or refunded
            </Text>
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
        {/* rhino.fi payouts pay no Solid deposit fee. */}
        {row.kind === 'own' ? (
          <DepositFeeNotice
            product="wallet"
            provider={provider}
            chainId={chainId}
            symbol={symbol}
            className="mt-2"
          />
        ) : null}
        <Pressable
          className="flex-row items-center justify-center gap-x-1 web:hover:opacity-70"
          onPress={() => openHelpLink(WALLET_DEPOSIT_LEARN_URL)}
        >
          <Text className="text-sm text-white">Learn about deposits</Text>
          <ChevronRight color="white" size={16} />
        </Pressable>
      </View>

      {rhino ? (
        <RhinoDepositStatus
          enabled={!!address}
          depositAddress={address}
          chain={rhino.chain.chain}
          chainName={rhinoChainName ?? rhino.chain.name}
          addressType={rhinoAddress?.addressType ?? rhino.chain.addressType}
        />
      ) : null}

      {isScanning ? (
        <View className="flex-row items-center gap-x-2 self-center rounded-[18px] bg-[#333333] px-4 py-2">
          <Text className="text-sm leading-4 text-white">
            {isDetected ? 'Deposit detected' : 'Scanning for deposits'}
          </Text>
          <DepositScanningIndicator />
        </View>
      ) : null}

      <Button
        variant="brand"
        className="h-12 w-full rounded-full"
        onPress={handleCopy}
        disabled={!address}
      >
        <Text className="text-base font-bold text-black">
          {copied ? 'Address copied' : 'Copy address'}
        </Text>
      </Button>

      {/* Last child, so paint order puts the open list over everything above. */}
      {isNetworkOpen ? (
        <WalletDepositNetworkList
          chainId={chainId}
          symbol={symbol}
          onSelect={handleSelectNetwork}
          onDismiss={() => setIsNetworkOpen(false)}
        />
      ) : null}
    </View>
  );
};

export default WalletDepositAddress;
