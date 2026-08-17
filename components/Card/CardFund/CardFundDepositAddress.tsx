import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageSourcePropType, Linking, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import {
  CARD_FUND_ESTIMATED_TIME,
  CARD_FUND_LEARN_URL,
  getCardFundNetworks,
} from '@/components/Card/CardFund/constants';
import DepositScanningIndicator from '@/components/Card/CardFund/DepositScanningIndicator';
import CopyToClipboard from '@/components/CopyToClipboard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDetectedDirectDeposit } from '@/hooks/useDetectedDirectDeposit';
import { DetectedDirectDepositResponse } from '@/lib/types';
import { eclipseAddress } from '@/lib/utils';

/** Design caps the QR at 259px; below that it tracks the card width. */
const QR_MAX_SIZE = 259;
const NETWORK_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type CardFundDepositAddressProps = {
  /** Deposit address for the selected token + chain. Undefined while loading. */
  address?: string;
  symbol: string;
  chainId: number;
  /** Returns to network selection — the chevron on the network summary row. */
  onChangeNetwork: () => void;
  /**
   * Fired once the backend sees a transfer land on this address (as early as the
   * `received` step). The modal closes and hands the user to the activity screen.
   */
  onDepositDetected?: (clientTxId: string) => void;
};

/** Step 3 of the card funding flow — the deposit address, QR and network summary. */
const CardFundDepositAddress = ({
  address,
  symbol,
  chainId,
  onChangeNetwork,
  onDepositDetected,
}: CardFundDepositAddressProps) => {
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState(QR_MAX_SIZE);

  const handleDetected = useCallback(
    (deposit: DetectedDirectDepositResponse) => {
      if (deposit.clientTxId) onDepositDetected?.(deposit.clientTxId);
    },
    [onDepositDetected],
  );

  const { isDetected } = useDetectedDirectDeposit({
    enabled: !!address,
    destinationType: 'RAIN_CARD',
    onDetected: handleDetected,
  });

  const network = useMemo(
    () => getCardFundNetworks(symbol).find(item => item.chainId === chainId),
    [symbol, chainId],
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
      <View className="items-center gap-y-3 rounded-[15px] bg-card px-4 py-6">
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

        <View className="flex-row items-center gap-x-2 rounded-[18px] bg-[#333333] px-4 py-2">
          <Text className="text-sm leading-4 text-white">
            {isDetected ? 'Deposit detected' : 'Scanning for deposits'}
          </Text>
          <DepositScanningIndicator />
        </View>
      </View>

      <Pressable
        className="flex-row items-center justify-center gap-x-1 web:hover:opacity-70"
        onPress={() => Linking.openURL(CARD_FUND_LEARN_URL)}
      >
        <Text className="text-sm text-white">Learn about deposits</Text>
        <ChevronRight color="white" size={16} />
      </Pressable>

      <CardFundGroup>
        <CardFundRow
          icon={
            network?.icon ? (
              <Image source={network.icon} style={NETWORK_ICON_STYLE} contentFit="cover" />
            ) : (
              <View style={NETWORK_ICON_STYLE} />
            )
          }
          title={network?.name ?? ''}
          chips={[CARD_FUND_ESTIMATED_TIME]}
          chipsPosition="inline"
          trailing={<ChevronDown color="white" size={20} />}
          onPress={onChangeNetwork}
        />
      </CardFundGroup>

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

export default CardFundDepositAddress;
