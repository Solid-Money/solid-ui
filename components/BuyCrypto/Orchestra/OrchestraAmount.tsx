import { useEffect, useMemo } from 'react';
import { TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { useOrchestraNavigation } from '@/components/BuyCrypto/Orchestra/OrchestraNavigation';
import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import {
  ORCHESTRA_FALLBACK_MAX_USD,
  ORCHESTRA_FALLBACK_MIN_USD,
  useCreateOrchestraOnramp,
  useOrchestraDestinationAsset,
  useOrchestraLimits,
} from '@/hooks/useOrchestra';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { EXPO_PUBLIC_ORCHESTRA_DESTINATION_ASSET } from '@/lib/config';
import { asOrchestraError } from '@/lib/orchestraErrors';
import { fiatLimitsFromResponse, formatUsd } from '@/lib/orchestraFormat';
import { useOrchestraStore } from '@/store/useOrchestraStore';

/**
 * First step of the Lightning onramp: how much USD to deposit.
 *
 * There is no live quote on this screen, and that is a property of the API
 * rather than an omission. GET /estimate prices in sats only — it has no fiat
 * parameter under any spelling — and the app has no spot source of its own, so
 * a dollar figure here could only be quoted against a rate Orchestra didn't
 * agree to. POST /onramp is the first call that accepts `amountFiatUsd`, and it
 * answers with the real sats, fee and delivery at Orchestra's own spot.
 *
 * So the invoice screen is the review step: it shows those numbers, nothing is
 * charged until the invoice is paid, and back returns here. What this screen
 * owes the user is the band their amount has to fall in, which /limits gives —
 * operator-tuned and fetched rather than hardcoded.
 */
export const OrchestraAmount = () => {
  const setModal = useOrchestraNavigation();
  const { user } = useUser();

  const amountUsd = useOrchestraStore(state => state.amountUsd);
  const setAmountUsd = useOrchestraStore(state => state.setAmountUsd);
  const setOrder = useOrchestraStore(state => state.setOrder);
  const setError = useOrchestraStore(state => state.setError);

  useEffect(() => {
    track(TRACKING_EVENTS.ORCHESTRA_AMOUNT_VIEWED);
  }, []);

  const { data: limits } = useOrchestraLimits();
  const { data: destinationAsset } = useOrchestraDestinationAsset();
  const { mutate: createOrder, isPending: creatingOrder } = useCreateOrchestraOnramp();

  const fiat = useMemo(() => fiatLimitsFromResponse(limits), [limits]);
  // The published band is the guardrail; the documented "1.00" to "50000.00" is
  // the floor under it, so a /limits call that fails doesn't leave the form with
  // no bounds at all.
  const minUsd = Number(fiat?.min ?? ORCHESTRA_FALLBACK_MIN_USD);
  const maxUsd = Number(fiat?.max ?? ORCHESTRA_FALLBACK_MAX_USD);

  const amountNum = Number(amountUsd);
  const hasAmount = Number.isFinite(amountNum) && amountNum > 0;
  const belowMin = hasAmount && amountNum < minUsd;
  const aboveMax = hasAmount && amountNum > maxUsd;
  const inRange = hasAmount && !belowMin && !aboveMax;

  const symbol = destinationAsset?.assetDisplaySymbol ?? EXPO_PUBLIC_ORCHESTRA_DESTINATION_ASSET;
  const network = destinationAsset?.chainDisplayName;

  // No Safe address means nothing to deliver to. It is set during onboarding, so
  // this only bites a half-provisioned account — which should see a disabled
  // button, not one that does nothing.
  const recipientAddress = user?.safeAddress;
  const continueDisabled = !inRange || creatingOrder || !recipientAddress;

  const handleContinue = () => {
    if (!inRange || !recipientAddress) return;

    createOrder(
      {
        recipientAddress,
        // Two decimal places: the field is a USD string, and sending the raw box
        // contents would put "10." or "10.999" on the wire.
        amountFiatUsd: amountNum.toFixed(2),
        // No refundAddress: the user has no Lightning address to refund to, and
        // Orchestra only accepts one of those or a BOLT11. A failure before the
        // swap therefore needs Orchestra-side recovery rather than an automatic
        // refund — see the refund_address_missing order error.
      },
      {
        onSuccess: order => {
          track(TRACKING_EVENTS.ORCHESTRA_ORDER_CREATED, {
            order_id: order.orderId,
            amount_usd: amountNum,
            amount_mode: order.amountMode,
            has_cash_app_link: Boolean(order.paymentLinks?.cashApp),
          });
          setOrder(order);
          setModal(DEPOSIT_MODAL.OPEN_ORCHESTRA_INVOICE);
        },
        onError: error => {
          const orchestraError = asOrchestraError(error);
          track(TRACKING_EVENTS.ORCHESTRA_ORDER_CREATION_FAILED, {
            amount_usd: amountNum,
            error_code: orchestraError.code,
            error_action: orchestraError.action,
            error_message: orchestraError.rawMessage,
          });
          setError(orchestraError, DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT);
          setModal(DEPOSIT_MODAL.OPEN_ORCHESTRA_ERROR);
        },
      },
    );
  };

  return (
    <View className="shrink-0 gap-6">
      <View className="gap-2.5">
        <Text className="text-base font-medium text-white/70">You pay</Text>
        <View className="h-[80px] flex-row items-center justify-between rounded-[15px] bg-[#1C1C1C] pl-4 pr-3.5">
          <View className="mr-3 flex-1 flex-row items-center">
            <Text className="text-3xl font-semibold text-white/50">$</Text>
            <TextInput
              accessibilityLabel="Amount in US dollars"
              value={amountUsd}
              onChangeText={t => setAmountUsd(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.5)"
              className="flex-1 p-0 text-3xl font-semibold text-white web:outline-none"
              style={{ fontFamily: 'MonaSans_600SemiBold' }}
            />
          </View>
          <View className="h-12 shrink-0 flex-row items-center gap-[7px] rounded-full bg-white/10 px-3">
            <Image
              source={getAsset('images/usdc-4x.png')}
              style={{ width: 24, height: 24 }}
              contentFit="contain"
            />
            <Text className="text-lg font-semibold text-white">{symbol}</Text>
          </View>
        </View>
        <Text className="text-sm font-medium leading-5 text-white/70">
          You&apos;ll receive {symbol}
          {network ? ` on ${network}` : ''} in your wallet
        </Text>
      </View>

      <View className="gap-2 rounded-[15px] bg-[#1C1C1C] p-4">
        <Text className="text-base font-semibold leading-[22px] text-white">How this works</Text>
        <Text className="text-sm font-medium leading-5 text-white/70">
          We&apos;ll create a Lightning invoice for this amount. You&apos;ll see the exact rate,
          fee, and what you receive before you pay anything.
        </Text>
        <Text className="text-xs font-medium leading-[18px] text-white/50">
          Between {formatUsd(minUsd)} and {formatUsd(maxUsd)} per deposit
        </Text>
        {belowMin ? (
          <Text className="text-xs text-red-500">Enter at least {formatUsd(minUsd)}.</Text>
        ) : null}
        {aboveMax ? (
          <Text className="text-xs text-red-500">Enter at most {formatUsd(maxUsd)}.</Text>
        ) : null}
      </View>

      <View className="gap-[18px]">
        <Text className="text-xs font-medium leading-[17px] text-white/50">
          You&apos;ll pay a Lightning invoice with Cash App, Strike, or any Lightning wallet.
          Conversion is provided by Flashnet; rates and fees are set by Flashnet and may change. Not
          available to residents of New York City.
        </Text>

        <Button
          className={`h-12 rounded-full ${continueDisabled ? 'bg-white/20 active:scale-100 active:opacity-100 web:hover:bg-white/20' : ''}`}
          variant="brand"
          onPress={handleContinue}
          disabled={continueDisabled}
        >
          <Text
            className={
              continueDisabled ? 'text-base font-bold text-white' : 'text-base font-bold text-black'
            }
          >
            {creatingOrder
              ? 'Creating invoice…'
              : belowMin || aboveMax
                ? 'Amount out of limits'
                : 'Continue'}
          </Text>
        </Button>

        <NeedHelp />
      </View>
    </View>
  );
};

export default OrchestraAmount;
