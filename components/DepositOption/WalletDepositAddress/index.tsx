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
import { getRhinoChainIcon } from '@/components/DepositOption/RhinoDeposit/RhinoChainIcon';
import RhinoDepositDetails from '@/components/DepositOption/RhinoDeposit/RhinoDepositDetails';
import RhinoDepositStatus from '@/components/DepositOption/RhinoDeposit/RhinoDepositStatus';
import { useRhinoAddressAnalytics } from '@/components/DepositOption/RhinoDeposit/useRhinoAddressAnalytics';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useDepositAssets } from '@/hooks/useDepositAssets';
import { useDetectedDirectDeposit } from '@/hooks/useDetectedDirectDeposit';
import { useEuroSpendEnablement } from '@/hooks/useEuroSpendEnablement';
import { useRhinoDepositAddress } from '@/hooks/useRhinoDepositAddress';
import { useOfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';
import { useWalletDepositAddress } from '@/hooks/useWalletDepositAddress';
import { track } from '@/lib/analytics';
import { openHelpLink } from '@/lib/help/links';
import { findRhinoRoute, formatDepositAddress, RhinoDepositSelection } from '@/lib/rhinoDeposit';
import { useDepositStore } from '@/store/useDepositStore';

import {
  formatWalletDepositMinimum,
  getDefaultWalletDepositSelection,
  getWalletDepositNetworks,
  getWalletDepositTokenIcon,
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

/**
 * "Deposit Address" — where a crypto deposit into the wallet is sent.
 *
 * The address is the user's Safe, which is the same on every chain, so the chain
 * and currency pills do not change it: they decide which currencies are on offer,
 * what the minimum transfer is, and which chain the QR is labelled for. Sending
 * a currency the chosen chain does not list, or less than its minimum, is what
 * the copy under the QR is there to prevent.
 *
 * A rhino.fi chain (Tron, Solana, …) picked from the network list is the
 * exception: the screen shows the user's rhino.fi address for it instead, which
 * is not the Safe and, for Tron and Solana, not a 0x address at all.
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

  // A rhino.fi chain only counts while rhino.fi still offers this currency into
  // the wallet there; otherwise the screen is the Safe on `chainId` as before.
  const rhinoAssets = useOfferedRhinoDepositAssets();
  const rhinoSelection = useMemo<RhinoDepositSelection | undefined>(
    () =>
      walletDeposit.rhinoChain
        ? { chain: walletDeposit.rhinoChain, tokenSymbol: symbol, destinationType: 'WALLET' }
        : undefined,
    [walletDeposit.rhinoChain, symbol],
  );
  const rhino = useMemo(
    () => (rhinoSelection ? findRhinoRoute(rhinoAssets, rhinoSelection) : undefined),
    [rhinoAssets, rhinoSelection],
  );
  const activeRhinoSelection = rhino ? rhinoSelection : undefined;
  const {
    address: rhinoAddress,
    isError: hasRhinoAddressError,
    refetch: refetchRhinoAddress,
  } = useRhinoDepositAddress(activeRhinoSelection);
  const trackRhinoCopy = useRhinoAddressAnalytics(
    activeRhinoSelection,
    rhinoAddress?.depositAddress,
  );

  // A Wirex cardholder's stablecoins get an address the pipeline mints and
  // watches; everything else gets the Safe, which is where it lands and stays.
  const {
    address: walletAddress,
    isError: hasWalletAddressError,
    isMinted,
  } = useWalletDepositAddress(chainId, symbol);
  const address = rhino ? rhinoAddress?.depositAddress : walletAddress;
  const hasAddressError = rhino ? hasRhinoAddressError : hasWalletAddressError;
  const qrLogo = rhino ? getRhinoChainIcon(rhino.chain.chain) : network?.icon;
  // Wirex cardholders and people with no card both land here, and only the
  // cardholders are charged — see `getDepositFeeRatePpm`.
  const { provider } = useCardProvider();
  const viewer = useWalletDepositViewer();
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
  const isScanning = !!address && isMinted && !rhino;
  const { isDetected } = useDetectedDirectDeposit({
    enabled: isScanning,
    destinationType: CARD_FUND_DESTINATION_TYPE,
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

  // The list only offers rhino.fi chains taking the current currency into the
  // wallet, so the currency stays as it is.
  const handleSelectRhinoNetwork = useCallback(
    (chain: string) => {
      const selected = rhinoAssets?.chains.find(item => item.chain === chain);
      track(TRACKING_EVENTS.DEPOSIT_RHINO_NETWORK_SELECTED, {
        deposit_method: 'rhino_deposit_address',
        destination_type: 'WALLET',
        rhino_chain: chain,
        network_name: selected?.name,
        token_symbol: symbol,
      });
      setWalletDeposit({ rhinoChain: chain });
      setIsNetworkOpen(false);
    },
    [rhinoAssets, setWalletDeposit, symbol],
  );

  return (
    <View className="gap-y-6">
      <WalletDepositSelectors
        chainId={chainId}
        symbol={symbol}
        rhinoChain={rhino ? { chain: rhino.chain.chain, name: rhino.chain.name } : undefined}
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
            {hasAddressError && rhino ? (
              <View className="items-center gap-y-3 px-6">
                <Text className="text-center text-sm text-white/70">
                  Could not load the deposit address.
                </Text>
                <Button
                  variant="secondary"
                  className="h-10 rounded-full px-6"
                  onPress={() => void refetchRhinoAddress()}
                >
                  <Text className="text-sm font-semibold">Try again</Text>
                </Button>
              </View>
            ) : hasAddressError ? (
              <Text className="px-6 text-center text-sm text-white/70">
                Could not load the deposit address. Close and try again.
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
        {rhino ? (
          <RhinoDepositDetails
            tokenSymbol={symbol}
            chainName={rhino.chain.name}
            destinationType="WALLET"
            receiveSymbol={rhinoAddress?.receiveSymbol ?? rhino.route.receiveSymbol}
            receiveChainId={rhinoAddress?.receiveChainId ?? rhino.route.receiveChainId}
            minimumUsd={rhinoAddress?.minimumUsd ?? rhino.route.minimumUsd}
            maximumUsd={rhinoAddress?.maximumUsd ?? rhino.route.maximumUsd}
          />
        ) : (
          <>
            <View className="flex-row flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
              <Text className="text-base font-medium text-white">Send at least</Text>
              <Image source={tokenIcon} style={INLINE_ICON_STYLE} contentFit="cover" />
              {/* "10 USDC", "0.005 WETH" and "0.00012 cbBTC" all read right, rounded up. */}
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
        )}
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
        {rhino ? null : (
          <DepositFeeNotice
            product="wallet"
            provider={provider}
            chainId={chainId}
            symbol={symbol}
            className="mt-2"
          />
        )}
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
          chainName={rhino.chain.name}
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
          rhinoChain={rhino ? rhino.chain.chain : undefined}
          onSelect={handleSelectNetwork}
          onSelectRhino={handleSelectRhinoNetwork}
          onDismiss={() => setIsNetworkOpen(false)}
        />
      ) : null}
    </View>
  );
};

export default WalletDepositAddress;
