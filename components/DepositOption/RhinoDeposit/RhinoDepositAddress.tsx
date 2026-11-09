import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageSourcePropType, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { ChevronDown } from 'lucide-react-native';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import CopyToClipboard from '@/components/CopyToClipboard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import { useDetectedDirectDeposit } from '@/hooks/useDetectedDirectDeposit';
import { useRhinoDepositAddress } from '@/hooks/useRhinoDepositAddress';
import { useOfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';
import { findRhinoRoute, formatDepositAddress, RhinoDepositSelection } from '@/lib/rhinoDeposit';
import { DetectedDirectDepositResponse } from '@/lib/types';

import RhinoChainIcon, { getRhinoChainIcon } from './RhinoChainIcon';
import RhinoDepositDetails from './RhinoDepositDetails';
import RhinoDepositStatus from './RhinoDepositStatus';
import { useRhinoAddressAnalytics } from './useRhinoAddressAnalytics';

/** Design caps the QR at 259px; below that it tracks the card width. */
const QR_MAX_SIZE = 259;
const NETWORK_ICON_SIZE = 36;

type RhinoDepositAddressProps = {
  selection: RhinoDepositSelection;
  /** Returns to the network list — the chevron on the network summary row. */
  onChangeNetwork: () => void;
  /**
   * Fired once the regular pipeline sees rhino.fi's payout land at the savings
   * or card destination, as the same screens do for a direct transfer. The host
   * closes and hands the user to the deposit's activity.
   */
  onDepositDetected?: (clientTxId: string) => void;
};

/**
 * The savings and card funding flows' address step for a row rhino.fi serves:
 * the user's rhino.fi address, its QR, what to send and within which limits,
 * what arrives, and rhino.fi's progress on it.
 *
 * rhino.fi is the only provider on that row, so an address that cannot be had
 * is a failure shown here, with a retry, and never a direct-deposit session in
 * its place.
 *
 * No deposit fee notice, unlike the direct-deposit address: rhino.fi payouts pay
 * no Solid deposit fee.
 */
const RhinoDepositAddress = ({
  selection,
  onChangeNetwork,
  onDepositDetected,
}: RhinoDepositAddressProps) => {
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState(QR_MAX_SIZE);

  const { assets } = useOfferedRhinoDepositAssets();
  const offered = useMemo(() => findRhinoRoute(assets, selection), [assets, selection]);
  const { address, isError, isFetching, refetch } = useRhinoDepositAddress(selection);

  const depositAddress = address?.depositAddress;
  const { chainId } = selection;
  // The row keeps the name it has in the list ("Polygon", not rhino.fi's own),
  // so the screen reads as the row that was tapped. A "More networks" chain has
  // no row of ours, so it is rhino.fi's name.
  const appChainName = chainId !== undefined ? getBridgeChain(chainId)?.name : undefined;
  const chainName = appChainName ?? address?.chainName ?? offered?.chain.name ?? selection.chain;
  const addressType = address?.addressType ?? offered?.chain.addressType;
  const chainIcon = getRhinoChainIcon(selection.chain, chainId);
  const trackCopy = useRhinoAddressAnalytics(selection, depositAddress);

  // rhino.fi pays out to the same savings / card destination a direct transfer
  // goes to, where the regular pipeline credits it. Its detection is what hands
  // the user to the activity, exactly as on the direct-deposit address.
  const detectedDestination =
    selection.destinationType === 'WALLET' ? undefined : selection.destinationType;
  const handleDetected = useCallback(
    (deposit: DetectedDirectDepositResponse) => {
      if (deposit.clientTxId) onDepositDetected?.(deposit.clientTxId);
    },
    [onDepositDetected],
  );
  useDetectedDirectDeposit({
    enabled: !!depositAddress && !!detectedDestination,
    destinationType: detectedDestination,
    onDetected: handleDetected,
  });

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    if (!depositAddress) return;
    await Clipboard.setStringAsync(depositAddress);
    setCopied(true);
    trackCopy();
  }, [depositAddress, trackCopy]);

  return (
    <View className="gap-y-4">
      <View className="items-center gap-y-3 rounded-[15px] bg-card px-4 py-6">
        <View className="flex-row items-center justify-center">
          <Text className="text-lg font-medium text-white" selectable>
            {depositAddress ? formatDepositAddress(depositAddress) : '—'}
          </Text>
          {depositAddress ? (
            <CopyToClipboard
              text={depositAddress}
              className="h-8 w-8 bg-transparent web:hover:bg-transparent web:active:bg-transparent"
              iconClassName="text-white"
              onCopy={trackCopy}
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
          {depositAddress ? (
            <QRCode
              value={depositAddress}
              size={qrSize}
              color="white"
              backgroundColor="#1C1C1C"
              {...(chainIcon
                ? {
                    logo: chainIcon as ImageSourcePropType,
                    logoSize: Math.round(qrSize * 0.154),
                    logoBorderRadius: Math.round(qrSize * 0.077),
                    logoBackgroundColor: 'transparent',
                  }
                : {})}
            />
          ) : isError && !isFetching ? (
            <View className="items-center gap-y-3 px-6">
              <Text className="text-center text-sm text-white/70">
                Could not load the deposit address.
              </Text>
              <Button
                variant="secondary"
                className="h-10 rounded-full px-6"
                onPress={() => void refetch()}
              >
                <Text className="text-sm font-semibold">Try again</Text>
              </Button>
            </View>
          ) : (
            <ActivityIndicator color="white" />
          )}
        </View>

        <RhinoDepositStatus
          enabled={!!depositAddress}
          depositAddress={depositAddress}
          chain={selection.chain}
          chainName={chainName}
          addressType={addressType}
        />
      </View>

      <RhinoDepositDetails
        tokenSymbol={selection.tokenSymbol}
        chain={selection.chain}
        chainName={chainName}
        destinationType={selection.destinationType}
        receiveSymbol={address?.receiveSymbol ?? offered?.route.receiveSymbol}
        receiveChainId={address?.receiveChainId ?? offered?.route.receiveChainId}
        vault={address?.vault ?? offered?.route.vault}
        minimumUsd={address?.minimumUsd ?? offered?.route.minimumUsd}
        maximumUsd={address?.maximumUsd ?? offered?.route.maximumUsd}
      />

      <CardFundGroup>
        <CardFundRow
          icon={
            <RhinoChainIcon
              chain={selection.chain}
              chainId={chainId}
              name={chainName}
              size={NETWORK_ICON_SIZE}
            />
          }
          title={chainName}
          trailing={<ChevronDown color="white" size={20} />}
          onPress={onChangeNetwork}
        />
      </CardFundGroup>

      <Button
        variant="brand"
        className="h-12 w-full rounded-full"
        onPress={handleCopy}
        disabled={!depositAddress}
      >
        <Text className="text-base font-bold text-black">
          {copied ? 'Address copied' : 'Copy address'}
        </Text>
      </Button>
    </View>
  );
};

export default RhinoDepositAddress;
