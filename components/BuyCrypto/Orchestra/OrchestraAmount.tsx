import { useEffect, useMemo } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { useOrchestraNavigation } from '@/components/BuyCrypto/Orchestra/OrchestraNavigation';
import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useDebounce from '@/hooks/useDebounce';
import {
  ORCHESTRA_FALLBACK_MAX_USD,
  ORCHESTRA_FALLBACK_MIN_USD,
  useCreateOrchestraOnramp,
  useOrchestraDestinationAsset,
  useOrchestraEstimate,
  useOrchestraLimits,
} from '@/hooks/useOrchestra';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { EXPO_PUBLIC_ORCHESTRA_DESTINATION_ASSET } from '@/lib/config';
import { asOrchestraError } from '@/lib/orchestraErrors';
import {
  fiatLimitsFromResponse,
  formatSats,
  formatSmallestUnits,
  formatUsd,
} from '@/lib/orchestraFormat';
import { useOrchestraStore } from '@/store/useOrchestraStore';

/** Wait for typing to settle before pricing — each amount is an Orchestra call. */
const ESTIMATE_DEBOUNCE_MS = 500;

/**
 * First step of the Lightning onramp: how much USD to deposit.
 *
 * The user pays in dollars and Orchestra converts at spot, so the box is in USD
 * and everything under it — sats in, asset out, fee — is what that buys. The
 * band comes from /limits rather than being hardcoded: it is operator-tuned and
 * changes without notice, and an amount inside it can still be refused when the
 * order is created, which is why the failure path exists at all.
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

  // Price on the settled amount, not on every keystroke: typing "400" would
  // otherwise fire estimates for 4, 40 and 400 and leave the first two racing.
  const debouncedAmount = useDebounce(amountUsd, ESTIMATE_DEBOUNCE_MS);
  // Quote the same number the order will be created for. The box holds whatever
  // is being typed — "10." on the way to "10.50", or "10.999" — and pricing the
  // raw string while minting the invoice from a rounded one is how a user comes
  // to be shown one total and charged another.
  const quotedAmount = useMemo(() => {
    const value = Number(debouncedAmount);
    return Number.isFinite(value) && value > 0 ? value.toFixed(2) : '';
  }, [debouncedAmount]);

  const {
    data: estimate,
    isFetching: estimateFetching,
    error: estimateError,
  } = useOrchestraEstimate(quotedAmount, inRange);

  // A failed estimate is a settled question, not a pending one. Without the
  // error term this stays true forever — react-query clears `data` on error and
  // nothing refetches — leaving the card spinning under its own error message.
  const isEstimatePending =
    inRange && !estimateError && (estimateFetching || amountUsd !== debouncedAmount || !estimate);
  const liveEstimate = isEstimatePending ? undefined : estimate;

  const symbol = destinationAsset?.assetDisplaySymbol ?? EXPO_PUBLIC_ORCHESTRA_DESTINATION_ASSET;
  const network = destinationAsset?.chainDisplayName;
  const receiveAmount = formatSmallestUnits(liveEstimate?.estimatedOut, destinationAsset?.decimals);
  const payAmount = formatSats(liveEstimate?.amountIn);

  /**
   * The fee is denominated in whatever asset the route settles it in — this
   * corridor's is USDC, but a BTC destination is charged in sats — so the fee's
   * own asset picks the decimals. Scaling sats by the destination's six places
   * would print a 1,500-sat fee as "0", and an asset we have no exponent for is
   * left unstated rather than stated wrongly.
   */
  const feeLabel = (() => {
    const feeAmount = liveEstimate?.feeAmount;
    if (!feeAmount) return undefined;
    const feeAsset = liveEstimate?.feeAsset;
    if (!feeAsset || feeAsset === destinationAsset?.asset || feeAsset === symbol) {
      const formatted = formatSmallestUnits(feeAmount, destinationAsset?.decimals);
      return formatted ? `${formatted} ${symbol}` : undefined;
    }
    if (feeAsset === 'BTC') return formatSats(feeAmount);
    return undefined;
  })();

  // No Safe address means nothing to deliver to. It is set during onboarding, so
  // this only bites a half-provisioned account — which should see a disabled
  // button, not one that does nothing.
  const recipientAddress = user?.safeAddress;
  // A failed estimate does not block the order. /estimate is indicative and needs
  // no key; /onramp is what actually decides, and its refusal reaches the user as
  // an error screen that says why — which beats a Continue button that can never
  // be pressed.
  const continueDisabled = !inRange || isEstimatePending || creatingOrder || !recipientAddress;

  const handleContinue = () => {
    if (!inRange || !recipientAddress) return;

    createOrder(
      {
        recipientAddress,
        // Normalised to two places, matching `quotedAmount` above, so the
        // invoice is minted for exactly the figure the quote priced.
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
        <Text className="text-base font-semibold leading-[22px] text-white">Your quote</Text>
        {!liveEstimate ? (
          <View className="min-h-10 justify-center">
            {isEstimatePending ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#94F27F" />
                <Text className="text-sm font-medium leading-5 text-white/70">
                  Getting your rate, fees, and total…
                </Text>
              </View>
            ) : !estimateError ? (
              <Text className="text-sm font-medium leading-5 text-white/70">
                Enter an amount to see your rate,{`\n`}fees, and total.
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="gap-2.5">
            <QuoteRow label="You pay over Lightning" value={payAmount ?? 'Not available'} />
            <QuoteRow label="Fee" value={feeLabel ?? 'Not available'} />
            <View className="h-px bg-white/10" />
            <QuoteRow
              label="You receive"
              value={receiveAmount ? `${receiveAmount} ${symbol}` : 'Not available'}
              emphasize
            />
          </View>
        )}
        {belowMin ? (
          <Text className="text-xs text-red-500">Enter at least {formatUsd(minUsd)}.</Text>
        ) : null}
        {aboveMax ? (
          <Text className="text-xs text-red-500">Enter at most {formatUsd(maxUsd)}.</Text>
        ) : null}
        {estimateError ? (
          <Text className="text-xs text-red-500">{asOrchestraError(estimateError).message}</Text>
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
                : isEstimatePending
                  ? 'Getting quote…'
                  : 'Continue'}
          </Text>
        </Button>

        <NeedHelp />
      </View>
    </View>
  );
};

const QuoteRow = ({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) => (
  <View className="flex-row items-center justify-between">
    <Text
      className={
        emphasize ? 'text-base font-semibold text-primary' : 'text-sm text-muted-foreground'
      }
    >
      {label}
    </Text>
    <Text className={emphasize ? 'text-base font-bold text-primary' : 'text-sm text-primary'}>
      {value}
    </Text>
  </View>
);

export default OrchestraAmount;
