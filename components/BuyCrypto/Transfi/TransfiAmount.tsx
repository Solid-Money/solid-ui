import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';

import { useBuyCryptoNavigation } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useDebounce from '@/hooks/useDebounce';
import {
  useCreateTransfiOrder,
  useTransfiPaymentConfig,
  useTransfiPaymentMethods,
  useTransfiQuote,
} from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { asTransfiError, TransfiError } from '@/lib/transfiErrors';
import { formatUsdcBound, resolveAmountLimits } from '@/lib/transfiLimits';
import { useTransfiStore } from '@/store/useTransfiStore';

/** Wait for typing to settle before quoting — each amount is a TransFi call. */
const QUOTE_DEBOUNCE_MS = 500;

const TOKEN_PILL_ICON_STYLE = { width: 20, height: 20 };

const formatFiat = (value: number | undefined, currency: string) =>
  value == null
    ? 'Not available'
    : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${currency}`;

/**
 * The quoted rate, in the direction this screen reads it.
 *
 * TransFi states the rate as USDC per unit of fiat (0.196 for BRL), so printing
 * it beside "1 USDC ≈" claimed a USDC cost about five BRL cents. The row says
 * what one USDC costs, so the rate is inverted here — and rounded, rather than
 * spilling `0.19611938571486007` across the line.
 */
const formatRate = (usdcPerFiat: number | undefined, currency: string) =>
  usdcPerFiat
    ? `1 USDC ≈ ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(
        1 / usdcPerFiat,
      )} ${currency}`
    : 'Not available';

/**
 * Primary buy-crypto screen: enter a USDC amount, then pick the fiat currency
 * and payment method (each opens its own modal step, like the swap token
 * selector). Shows the live local-currency quote. Selection state lives in
 * useTransfiStore so it survives the step transitions.
 */
export const TransfiAmount = () => {
  const setModal = useBuyCryptoNavigation();

  useEffect(() => {
    track(TRACKING_EVENTS.BUY_CRYPTO_AMOUNT_VIEWED);
  }, []);

  const amount = useTransfiStore(state => state.usdcAmount);
  const currency = useTransfiStore(state => state.fiatCurrency);
  const paymentCode = useTransfiStore(state => state.paymentCode);
  const setAmount = useTransfiStore(state => state.setAmount);
  const setFiatCurrency = useTransfiStore(state => state.setFiatCurrency);
  const setOrder = useTransfiStore(state => state.setOrder);
  const setError = useTransfiStore(state => state.setError);

  const { data: config, isLoading: configLoading, error: configError } = useTransfiPaymentConfig();

  // Without the config there is no currency list and no token to buy, so the
  // screen can only render an inert shell. A region TransFi has no payable
  // currency for lands here, and it deserves a sentence rather than a form that
  // never enables.
  useEffect(() => {
    if (!configError) return;
    setError(asTransfiError(configError), DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_ERROR);
  }, [configError, setError, setModal]);

  // Default the currency to the server suggestion once config loads.
  useEffect(() => {
    if (!currency && config?.defaultCurrency) {
      setFiatCurrency(config.defaultCurrency);
    }
  }, [config?.defaultCurrency, currency, setFiatCurrency]);

  const { data: methods } = useTransfiPaymentMethods(currency ?? undefined);
  const activePaymentCode = paymentCode || methods?.[0]?.paymentCode;

  // Quote on the settled amount, not on every keystroke: typing "400" would
  // otherwise fire quotes for 4, 40 and 400 and leave the first two racing.
  const debouncedAmount = useDebounce(amount, QUOTE_DEBOUNCE_MS);
  const {
    data: quote,
    isFetching: quoteFetching,
    error: quoteError,
  } = useTransfiQuote(debouncedAmount, currency ?? undefined, activePaymentCode, Boolean(config));

  const { mutate: createOrder, isPending: creatingOrder } = useCreateTransfiOrder();

  const amountNum = Number(amount);
  // The quote trails the input by the debounce plus the round trip, and the
  // previous one is kept as placeholder data — so only treat it as describing
  // the current amount once the echoed usdcAmount matches what's in the box.
  const isQuoteCurrent = quote != null && Number(quote.usdcAmount) === amountNum;
  const liveQuote = isQuoteCurrent ? quote : undefined;

  const selectedMethod = useMemo(
    () => methods?.find(m => m.paymentCode === activePaymentCode),
    [methods, activePaymentCode],
  );
  const selectedCurrency = useMemo(
    () => config?.currencies.find(c => c.currency === currency),
    [config?.currencies, currency],
  );

  // TransFi refuses to price an amount outside the limits, so an out-of-range
  // entry arrives as a failed quote rather than a quote that fails validation.
  // That is not an error screen — it is this input telling the user to change
  // the number, so it is handled here and the failure never leaves the step.
  const limitError =
    quoteError instanceof TransfiError && quoteError.action === 'adjust_amount'
      ? quoteError
      : undefined;
  const isQuotePending =
    amountNum > 0 &&
    !quoteError &&
    (quoteFetching || amount !== debouncedAmount || !isQuoteCurrent);

  // Last exchange rate seen for this currency + method, as TransFi quotes it —
  // USDC per unit of fiat. The limits are in fiat while the box is in USDC, so
  // without a rate the range can only be stated in a unit the user isn't
  // typing in.
  const pairKey = `${currency}:${activePaymentCode}`;
  const [lastRate, setLastRate] = useState<{ pair: string; usdcPerFiat: number }>();
  useEffect(() => {
    if (liveQuote?.exchangeRate) {
      setLastRate({
        pair: `${currency}:${activePaymentCode}`,
        usdcPerFiat: liveQuote.exchangeRate,
      });
    }
  }, [liveQuote?.exchangeRate, currency, activePaymentCode]);

  const { minLimit, maxLimit, minUsdc, maxUsdc, belowMin, aboveMax } = resolveAmountLimits({
    amount: amountNum,
    quote: liveQuote,
    quoteError,
    method: selectedMethod,
    usdcPerFiat: lastRate?.pair === pairKey ? lastRate.usdcPerFiat : undefined,
  });

  const isValid =
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    !isQuotePending &&
    !!liveQuote &&
    !belowMin &&
    !aboveMax &&
    !!activePaymentCode &&
    !!currency;
  const continueDisabled = !isValid || creatingOrder;
  const usdEquivalent =
    Number.isFinite(amountNum) && amountNum > 0
      ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amountNum)
      : '0';

  // Reported once per amount that lands out of range, not per keystroke: the
  // limits being wrong for a market is the signal, not how fast someone types.
  useEffect(() => {
    if (!limitError) return;
    track(TRACKING_EVENTS.BUY_CRYPTO_AMOUNT_OUT_OF_LIMITS, {
      usdc_amount: Number(debouncedAmount),
      currency,
      payment_code: activePaymentCode,
      min_limit: limitError.details.minLimit,
      max_limit: limitError.details.maxLimit,
    });
  }, [limitError, debouncedAmount, currency, activePaymentCode]);

  // Where the purchase lands, in the user's terms. A Wirex delivery is handed to
  // the card deposit address and bridged on to their Safe on Fuse, so naming the
  // network TransFi settles on would describe a leg the user never sees — it
  // says card balance, which is what the money becomes, and stops there.
  const receiveLine = (() => {
    if (config?.destinationType === 'card_direct_deposit') {
      return "You'll receive USDC in your card balance";
    }
    const network = config?.tokenNetwork ?? 'Base';
    const where =
      config?.destinationType === 'card_funding' ? 'in your card balance' : 'in your wallet';
    return `You'll receive USDC on ${network} ${where}`;
  })();

  const handleContinue = () => {
    if (!isValid || !activePaymentCode || !currency) return;
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'buy_crypto' });
    createOrder(
      { usdcAmount: amount, paymentCode: activePaymentCode, currency },
      {
        onSuccess: order => {
          track(TRACKING_EVENTS.BUY_CRYPTO_ORDER_CREATED, {
            order_id: order.orderId,
            usdc_amount: Number(amount),
            currency,
            payment_code: activePaymentCode,
            fiat_amount: liveQuote?.fiatAmount,
            total_fee: liveQuote?.totalFee,
            has_pay_url: Boolean(order.payUrl),
          });
          setOrder({ orderId: order.orderId, payUrl: order.payUrl });
          setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT);
        },
        onError: error => {
          const transfiError = asTransfiError(error);
          track(TRACKING_EVENTS.BUY_CRYPTO_ORDER_CREATION_FAILED, {
            usdc_amount: Number(amount),
            currency,
            payment_code: activePaymentCode,
            error_code: transfiError.code,
            error_action: transfiError.action,
            error_message: transfiError.message,
          });
          // TransFi's refusals (unsupported country, a compliance hold) used to
          // stop here, leaving the button re-enabled and the user with no idea
          // the order never existed. Hand it to the error step instead.
          setError(transfiError, DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
          setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_ERROR);
        },
      },
    );
  };

  if (configLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#94F27F" />
      </View>
    );
  }

  return (
    <View className="shrink-0 gap-6">
      <View className="gap-2.5">
        <Text className="text-base font-medium text-white/70">Amount</Text>
        <View className="h-[80px] flex-row items-center justify-between rounded-[15px] bg-[#1C1C1C] pl-4 pr-3.5">
          <View className="mr-3 flex-1">
            <TextInput
              accessibilityLabel="USDC amount"
              value={amount}
              onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor="rgba(255,255,255,0.5)"
              className="p-0 text-3xl font-semibold text-white web:outline-none"
              style={{ fontFamily: 'MonaSans_600SemiBold' }}
            />
            <Text className="text-base font-medium text-white/50">${usdEquivalent}</Text>
          </View>
          <View className="h-12 shrink-0 flex-row items-center gap-[7px] rounded-full bg-white/10 px-3">
            {/* Our own USDC mark, not TransFi's: theirs badges the delivery
                network onto the coin, so the pill read USDC-on-Ethereum. The
                network belongs in the line below, once, not on the icon. */}
            <Image
              source={getAsset('images/usdc-4x.png')}
              style={{ width: 24, height: 24 }}
              contentFit="contain"
            />
            <Text className="text-lg font-semibold text-white">
              {config?.tokenSymbol ?? 'USDC'}
            </Text>
          </View>
        </View>
        <Text className="text-sm font-medium leading-5 text-white/70">{receiveLine}</Text>
      </View>

      <View className="gap-2.5">
        <View className="flex-row gap-3">
          <SelectorField
            label="Pay in"
            value={currency ?? 'Select currency'}
            logoUrl={selectedCurrency?.logoUrl}
            onPress={() => setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_CURRENCY)}
          />
          <SelectorField
            label="Pay with"
            value={selectedMethod?.paymentName ?? selectedMethod?.paymentCode ?? 'Select method'}
            logoUrl={selectedMethod?.logo}
            onPress={() => setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT_METHOD)}
            disabled={!currency}
          />
        </View>
        {minLimit != null || maxLimit != null ? (
          <Text className="text-xs font-medium leading-[18px] text-white/50">
            Limits: {formatFiat(minLimit, currency ?? '')} – {formatFiat(maxLimit, currency ?? '')}
          </Text>
        ) : null}
      </View>

      {/* Quote breakdown */}
      <View className="gap-2 rounded-[15px] bg-[#1C1C1C] p-4">
        <Text className="text-base font-semibold leading-[22px] text-white">Your quote</Text>
        {!liveQuote ? (
          <View className="min-h-10 justify-center">
            {isQuotePending ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#94F27F" />
                <Text className="text-sm font-medium leading-5 text-white/70">
                  Getting your rate, fees, and total…
                </Text>
              </View>
            ) : !quoteError ? (
              <Text className="text-sm font-medium leading-5 text-white/70">
                Enter an amount to see your rate,{`\n`}fees, and total.
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="gap-2.5">
            <QuoteRow label="Rate" value={formatRate(liveQuote.exchangeRate, currency ?? '')} />
            <QuoteRow label="Fees" value={formatFiat(liveQuote.totalFee, currency ?? '')} />
            <View className="h-px bg-white/10" />
            <QuoteRow
              label="Total you pay"
              value={formatFiat(liveQuote.fiatAmount, currency ?? '')}
              emphasize
            />
          </View>
        )}
        {belowMin ? (
          <Text className="text-xs text-red-500">
            Enter at least {formatFiat(minLimit, currency ?? '')}
            {minUsdc != null ? ` (about ${formatUsdcBound(minUsdc, 'up')} USDC)` : ''}.
          </Text>
        ) : null}
        {aboveMax ? (
          <Text className="text-xs text-red-500">
            Enter at most {formatFiat(maxLimit, currency ?? '')}
            {maxUsdc != null ? ` (about ${formatUsdcBound(maxUsdc, 'down')} USDC)` : ''}.
          </Text>
        ) : null}
        {/* The quote itself failed on the limits and we have no rate to convert
            with — say so plainly rather than leaving the breakdown at "—". */}
        {limitError && !belowMin && !aboveMax ? (
          <Text className="text-xs text-red-500">{limitError.message}</Text>
        ) : null}
        {quoteError && !limitError ? (
          <Text className="text-xs text-red-500">{asTransfiError(quoteError).message}</Text>
        ) : null}
      </View>

      <View className="gap-[18px]">
        <Text className="text-xs font-medium leading-[17px] text-white/50">
          Crypto purchases are provided by TransFi. Rates and fees are set by TransFi and may
          change.
        </Text>

        <Button
          className={`h-12 rounded-full ${continueDisabled ? 'bg-white/20 active:scale-100 active:opacity-100 web:hover:bg-white/20' : ''}`}
          variant="brand"
          onPress={handleContinue}
          disabled={continueDisabled}
        >
          <Text
            className={continueDisabled ? 'text-base font-bold text-white' : 'text-base font-bold'}
          >
            {creatingOrder
              ? 'Creating order…'
              : belowMin || aboveMax || limitError
                ? 'Amount out of limits'
                : isQuotePending
                  ? 'Getting quote…'
                  : 'Continue to payment'}
          </Text>
        </Button>

        <NeedHelp />
      </View>
    </View>
  );
};

const SelectorField = ({
  label,
  value,
  logoUrl,
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  logoUrl?: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <View className="flex-1 gap-2.5">
    <Text className="text-base font-medium leading-[22px] text-white/70">{label}</Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      className="h-[54px] flex-row items-center justify-between rounded-[15px] bg-[#1C1C1C] px-3.5 active:opacity-80"
      onPress={onPress}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={TOKEN_PILL_ICON_STYLE} contentFit="contain" />
        ) : null}
        <Text className="flex-1 text-base font-medium text-white" numberOfLines={1}>
          {value}
        </Text>
      </View>
      <ChevronDown size={18} color="#FFFFFF" />
    </Pressable>
  </View>
);

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

export default TransfiAmount;
