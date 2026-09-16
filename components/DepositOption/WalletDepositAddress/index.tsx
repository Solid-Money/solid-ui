import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageSourcePropType, Linking, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import DepositScanningIndicator from '@/components/Card/CardFund/DepositScanningIndicator';
import CopyToClipboard from '@/components/CopyToClipboard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDetectedDirectDeposit } from '@/hooks/useDetectedDirectDeposit';
import useUser from '@/hooks/useUser';
import { eclipseAddress, formatNumber } from '@/lib/utils';

import {
  getDefaultWalletDepositSelection,
  getWalletDepositMinimum,
  getWalletDepositNetworks,
  getWalletDepositTokenIcon,
  getWalletDepositTokens,
  WALLET_DEPOSIT_LEARN_URL,
} from './constants';
import WalletDepositSelectors from './WalletDepositSelectors';

/** Design caps the QR at 259px; below that it tracks the card width. */
const QR_MAX_SIZE = 259;
const INLINE_ICON_STYLE = { width: 16, height: 16, borderRadius: 8 };

/**
 * "Deposit Address" — where a crypto deposit into the wallet is sent.
 *
 * The address is the user's Safe, which is the same on every chain, so the chain
 * and currency pills do not change it: they decide which currencies are on offer,
 * what the minimum transfer is, and which chain the QR is labelled for. Sending
 * a currency the chosen chain does not list, or less than its minimum, is what
 * the copy under the QR is there to prevent.
 */
const WalletDepositAddress = () => {
  const { user } = useUser();
  const address = user?.safeAddress;

  const [selection, setSelection] = useState(getDefaultWalletDepositSelection);
  const { chainId, symbol } = selection;
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState(QR_MAX_SIZE);

  const network = useMemo(
    () => getWalletDepositNetworks().find(item => item.chainId === chainId),
    [chainId],
  );
  const tokenIcon = getWalletDepositTokenIcon(chainId, symbol);
  const minimum = getWalletDepositMinimum(chainId, symbol);

  // Polling only runs once there is an address to watch, so the chip below has to
  // follow the same condition rather than claiming to scan with nothing to scan.
  const isScanning = !!address;
  const { isDetected } = useDetectedDirectDeposit({ enabled: isScanning });

  // Switching chain can strand a currency the new one does not carry (USDT off
  // Fuse, ETH off Base), which would leave the screen quoting a minimum for a
  // pairing that does not exist.
  const selectChain = useCallback((nextChainId: number) => {
    setSelection(current => {
      const tokens = getWalletDepositTokens(nextChainId);
      const symbolStillOffered = tokens.some(token => token.symbol === current.symbol);

      return {
        chainId: nextChainId,
        symbol: symbolStillOffered ? current.symbol : (tokens[0]?.symbol ?? current.symbol),
      };
    });
  }, []);

  const selectSymbol = useCallback(
    (nextSymbol: string) => setSelection(current => ({ ...current, symbol: nextSymbol })),
    [],
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
  }, [address]);

  return (
    <View className="gap-y-4">
      <WalletDepositSelectors
        chainId={chainId}
        symbol={symbol}
        onChainChange={selectChain}
        onSymbolChange={selectSymbol}
      />

      <View className="items-center gap-y-3 rounded-[15px] bg-card px-4 py-6">
        <View
          className="w-full items-center justify-center overflow-hidden rounded-xl"
          style={{ height: qrSize }}
          onLayout={event =>
            setQrSize(Math.min(Math.round(event.nativeEvent.layout.width), QR_MAX_SIZE))
          }
        >
          {address ? (
            <QRCode
              value={address}
              size={qrSize}
              color="white"
              backgroundColor="#1C1C1C"
              logo={network?.icon as ImageSourcePropType}
              logoSize={Math.round(qrSize * 0.154)}
              logoBorderRadius={Math.round(qrSize * 0.077)}
              logoBackgroundColor="transparent"
            />
          ) : (
            <ActivityIndicator color="white" />
          )}
        </View>

        <View className="flex-row items-center justify-center">
          <Text className="text-lg font-medium text-white">
            {address ? eclipseAddress(address, 7, 5) : '—'}
          </Text>
          {address ? (
            <CopyToClipboard
              text={address}
              className="h-8 w-8 bg-transparent web:hover:bg-transparent web:active:bg-transparent"
              iconClassName="text-white"
            />
          ) : null}
        </View>
      </View>

      <View className="gap-y-2">
        <View className="flex-row flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
          <Text className="text-sm text-white">Send at least</Text>
          <Image source={tokenIcon} style={INLINE_ICON_STYLE} contentFit="cover" />
          {/* Up to 4 decimals, none forced: "10 USDC" and "0.005 ETH" both read right. */}
          <Text className="text-sm text-white">{`${formatNumber(minimum, 4, 0)} ${symbol} on the`}</Text>
          {network?.icon ? (
            <Image source={network.icon} style={INLINE_ICON_STYLE} contentFit="cover" />
          ) : null}
          <Text className="text-sm text-white">{`${network?.name ?? ''} chain to this address`}</Text>
        </View>
        <Text className="text-center text-sm text-white/50">
          Deposits below the minimum will not be credited or refunded
        </Text>
      </View>

      <Pressable
        className="flex-row items-center justify-center gap-x-1 web:hover:opacity-70"
        onPress={() => Linking.openURL(WALLET_DEPOSIT_LEARN_URL)}
      >
        <Text className="text-sm text-white">Learn about deposits</Text>
        <ChevronRight color="white" size={16} />
      </Pressable>

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
    </View>
  );
};

export default WalletDepositAddress;
