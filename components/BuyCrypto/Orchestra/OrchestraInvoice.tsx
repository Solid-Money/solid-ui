import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useOrchestraNavigation } from '@/components/BuyCrypto/Orchestra/OrchestraNavigation';
import CopyToClipboard from '@/components/CopyToClipboard';
import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useOrchestraDestinationAsset } from '@/hooks/useOrchestra';
import { track } from '@/lib/analytics';
import { EXPO_PUBLIC_ORCHESTRA_DESTINATION_ASSET } from '@/lib/config';
import { formatSats, formatSmallestUnits } from '@/lib/orchestraFormat';
import { eclipseAddress } from '@/lib/utils';
import { useOrchestraStore } from '@/store/useOrchestraStore';

const solidLogo = require('@/assets/images/solid-white.png');

/** Seconds left until `expiresAt`, ticking, floored at zero. */
const useSecondsUntil = (expiresAt: string | undefined) => {
  const target = useMemo(() => (expiresAt ? Date.parse(expiresAt) : NaN), [expiresAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!Number.isFinite(target)) return undefined;
  return Math.max(0, Math.floor((target - now) / 1000));
};

const formatCountdown = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}:${String(rest).padStart(2, '0')}`;
};

/**
 * Second step: pay the invoice.
 *
 * The invoice is only ever handed to a wallet — opened as a Cash App deep link,
 * scanned off the QR, or copied into a Lightning wallet. It is never fetched:
 * the pay link is a launcher, and requesting it would burn the handoff without
 * paying anything.
 *
 * The invoice's own expiry is shown here and deliberately kept separate from
 * order tracking. An exact-in invoice lasts about 24 hours and an exact-out one
 * five minutes, but a payment that lands late can still settle during the
 * recovery window — so a lapsed countdown greys out this screen without ending
 * the order.
 */
export const OrchestraInvoice = () => {
  const setModal = useOrchestraNavigation();
  const order = useOrchestraStore(state => state.order);
  const amountUsd = useOrchestraStore(state => state.amountUsd);
  const { data: destinationAsset } = useOrchestraDestinationAsset();

  const secondsLeft = useSecondsUntil(order?.expiresAt);
  const hasExpired = secondsLeft === 0;

  useEffect(() => {
    track(TRACKING_EVENTS.ORCHESTRA_INVOICE_VIEWED, {
      order_id: order?.orderId,
      amount_usd: Number(amountUsd) || undefined,
      amount_mode: order?.amountMode,
    });
  }, [order?.orderId, order?.amountMode, amountUsd]);

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-center text-base text-red-500">
          Could not load the invoice. Please try again.
        </Text>
      </View>
    );
  }

  const symbol = destinationAsset?.assetDisplaySymbol ?? EXPO_PUBLIC_ORCHESTRA_DESTINATION_ASSET;
  const receiveAmount = formatSmallestUnits(order.estimatedOut, destinationAsset?.decimals);
  const payAmount = formatSats(order.amountIn);
  const cashAppUrl = order.paymentLinks?.cashApp;

  // The docs' own split: on a phone the pay link launches Cash App, on a desktop
  // it is something to scan with one. A phone camera pointed at that URL opens
  // Cash App, which a raw BOLT11 does not — so the desktop QR is the link and
  // the mobile QR is the invoice, for the wallet the user already has open.
  // Either way the copy row below hands out the invoice itself.
  const showsCashAppQr = Platform.OS === 'web' && Boolean(cashAppUrl);
  const qrValue = showsCashAppQr ? (cashAppUrl as string) : order.depositAddress;

  const openCashApp = () => {
    if (!cashAppUrl) return;
    track(TRACKING_EVENTS.ORCHESTRA_CASH_APP_OPENED, { order_id: order.orderId });
    void Linking.openURL(cashAppUrl);
  };

  return (
    <View className="flex-1 gap-5">
      <View className="items-center gap-2">
        <Text className="text-center text-2xl font-bold text-primary">
          {payAmount ?? 'Pay this invoice'}
        </Text>
        <Text className="text-center text-base text-muted-foreground">
          {receiveAmount ? `for about ${receiveAmount} ${symbol}` : `to receive ${symbol}`}
        </Text>
      </View>

      <View className="items-center gap-3">
        <View className="overflow-hidden rounded-3xl" style={{ opacity: hasExpired ? 0.4 : 1 }}>
          <QRCode
            value={qrValue}
            size={200}
            color="white"
            backgroundColor="#181A1A"
            logo={solidLogo}
            logoSize={50}
            logoBackgroundColor="transparent"
          />
        </View>
        <Text className="text-center text-sm text-muted-foreground">
          {showsCashAppQr
            ? 'Scan with your phone to pay in Cash App'
            : 'Scan with a Lightning wallet'}
        </Text>
        {secondsLeft != null ? (
          <Text
            className={`text-center text-sm ${hasExpired ? 'text-red-500' : 'text-muted-foreground'}`}
          >
            {hasExpired
              ? 'This invoice has expired. Go back to start a new one.'
              : `Expires in ${formatCountdown(secondsLeft)}`}
          </Text>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-sm text-muted-foreground">Lightning invoice</Text>
          <Text className="text-base font-medium text-primary" numberOfLines={1}>
            {eclipseAddress(order.depositAddress)}
          </Text>
        </View>
        <CopyToClipboard
          text={order.depositAddress}
          onCopy={() =>
            track(TRACKING_EVENTS.ORCHESTRA_INVOICE_COPIED, { order_id: order.orderId })
          }
        />
      </View>

      <Text className="px-1 text-xs text-muted-foreground">
        Pay with Cash App, Strike, or any Lightning wallet. Don&apos;t close this window — your
        deposit is tracked here once the payment is detected.
      </Text>

      <View className="mt-auto gap-3">
        {cashAppUrl ? (
          <Button
            className="h-14 rounded-full"
            variant="secondary"
            onPress={openCashApp}
            disabled={hasExpired}
          >
            <Text className="text-base font-semibold text-white">Open Cash App</Text>
          </Button>
        ) : null}
        <Button
          className="h-14 rounded-full"
          variant="brand"
          onPress={() => {
            track(TRACKING_EVENTS.ORCHESTRA_PAYMENT_CONFIRMED_BY_USER, {
              order_id: order.orderId,
            });
            setModal(DEPOSIT_MODAL.OPEN_ORCHESTRA_STATUS);
          }}
        >
          <Text className="text-base font-bold text-primary-foreground">I&apos;ve paid</Text>
        </Button>

        <NeedHelp />
      </View>
    </View>
  );
};

export default OrchestraInvoice;
