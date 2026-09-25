import { useEffect } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import NeedHelp from '@/components/NeedHelp';
import { useOrchestraNavigation } from '@/components/Orchestra/OrchestraNavigation';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCashAppDepositAvailability } from '@/hooks/useCashAppDepositAvailability';
import { useCreateOrchestraOnramp, useOrchestraConfig } from '@/hooks/useOrchestra';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import {
  asOrchestraError,
  ORCHESTRA_ERROR_CODE,
  orchestraErrorFromCode,
} from '@/lib/orchestraErrors';
import { formatUsd } from '@/lib/orchestraFormat';
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

  const amountUsd = useOrchestraStore(state => state.amountUsd);
  const setAmountUsd = useOrchestraStore(state => state.setAmountUsd);
  const setOrder = useOrchestraStore(state => state.setOrder);
  const setError = useOrchestraStore(state => state.setError);

  useEffect(() => {
    track(TRACKING_EVENTS.ORCHESTRA_AMOUNT_VIEWED);
  }, []);

  const { countryCode, isResolving: isResolvingCountry } = useCashAppDepositAvailability();
  // Held until geo settles. Asking before then sends no country, and the server
  // correctly answers "not available" to that — which the effect below would
  // read as a verdict on the user rather than on an unfinished lookup, and
  // bounce them to the error screen a beat before the real answer arrived.
  const {
    data: config,
    error: configError,
    isPending: configPending,
  } = useOrchestraConfig(countryCode, !isResolvingCountry);
  const { mutate: createOrder, isPending: creatingOrder } = useCreateOrchestraOnramp();

  // Without config there is no band to validate against and no asset to name,
  // so the screen can only render an inert form. Whatever went wrong — the
  // server has no Orchestra key, the backend is unreachable, the session
  // lapsed — the error screen states it, which is the whole reason this step
  // is reachable at all rather than hidden behind a vanishing row.
  // The row is gated on the same verdict, but this step is reachable by other
  // routes — a restored modal step, a user whose IP moved between sessions. The
  // server refuses order creation too, so this only saves a round trip.
  useEffect(() => {
    if (!config || config.isAvailable) return;
    setError(
      orchestraErrorFromCode(ORCHESTRA_ERROR_CODE.NOT_IN_AUDIENCE),
      DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT,
    );
    setModal(DEPOSIT_MODAL.OPEN_ORCHESTRA_ERROR);
  }, [config, setError, setModal]);

  useEffect(() => {
    if (!configError) return;
    setError(asOrchestraError(configError), DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT);
    setModal(DEPOSIT_MODAL.OPEN_ORCHESTRA_ERROR);
  }, [configError, setError, setModal]);

  // The backend already merged the live band with Orchestra's published floor,
  // so these are the bounds to enforce, not a starting point to second-guess.
  const minUsd = config?.minUsd ?? 0;
  const maxUsd = config?.maxUsd ?? 0;

  const amountNum = Number(amountUsd);
  const hasAmount = Number.isFinite(amountNum) && amountNum > 0;
  const belowMin = hasAmount && amountNum < minUsd;
  const aboveMax = hasAmount && amountNum > maxUsd;
  const inRange = hasAmount && !belowMin && !aboveMax;

  const symbol = config?.assetDisplaySymbol ?? config?.destinationAsset ?? 'USDC';
  const network = config?.chainDisplayName;

  // The band is only known once config lands; until then there is nothing to
  // validate against, so the button stays disabled rather than accepting an
  // amount that might be out of range.
  const continueDisabled = !config || !inRange || creatingOrder;

  const handleContinue = () => {
    if (!config || !inRange) return;

    // Only the amount: the recipient is the Safe the backend resolves from the
    // session, not a field this screen gets to choose.
    // Two decimal places, because the box holds whatever is being typed and
    // "10." or "10.999" should not reach the wire.
    createOrder(
      { amountFiatUsd: amountNum.toFixed(2), countryCode },
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

  if (configPending) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator size="large" color="#94F27F" />
      </View>
    );
  }

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
          We&apos;ll create a Cash App payment request for this amount. You&apos;ll see the exact
          rate, fee, and what you receive before you pay anything.
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
          You&apos;ll pay with Cash App. Conversion is provided by Flashnet; rates and fees are set
          by Flashnet and may change. Available in the US only, excluding New York.
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
