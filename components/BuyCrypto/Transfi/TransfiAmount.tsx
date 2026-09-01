import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

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
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

/** Wait for typing to settle before quoting — each amount is a TransFi call. */
const QUOTE_DEBOUNCE_MS = 500;

const TOKEN_PILL_ICON_STYLE = { width: 20, height: 20 };

const formatFiat = (value: number | undefined, currency: string) =>
  value == null
    ? '—'
    : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${currency}`;

/**
 * Primary buy-crypto screen: enter a USDC amount, then pick the fiat currency
 * and payment method (each opens its own modal step, like the swap token
 * selector). Shows the live local-currency quote. Selection state lives in
 * useTransfiStore so it survives the step transitions.
 */
export const TransfiAmount = () => {
  const setModal = useDepositStore(state => state.setModal);

  useEffect(() => {
    track(TRACKING_EVENTS.BUY_CRYPTO_AMOUNT_VIEWED);
  }, []);

  const amount = useTransfiStore(state => state.usdcAmount);
  const currency = useTransfiStore(state => state.fiatCurrency);
  const paymentCode = useTransfiStore(state => state.paymentCode);
  const setAmount = useTransfiStore(state => state.setAmount);
  const setFiatCurrency = useTransfiStore(state => state.setFiatCurrency);
  const setOrder = useTransfiStore(state => state.setOrder);

  const { data: config, isLoading: configLoading } = useTransfiPaymentConfig();

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
  const { data: quote, isFetching: quoteFetching } = useTransfiQuote(
    debouncedAmount,
    currency ?? undefined,
    activePaymentCode,
    Boolean(config),
  );

  const { mutate: createOrder, isPending: creatingOrder } = useCreateTransfiOrder();

  const amountNum = Number(amount);
  // The quote trails the input by the debounce plus the round trip, and the
  // previous one is kept as placeholder data — so only treat it as describing
  // the current amount once the echoed usdcAmount matches what's in the box.
  const isQuoteCurrent = quote != null && Number(quote.usdcAmount) === amountNum;
  const isQuotePending =
    amountNum > 0 && (quoteFetching || amount !== debouncedAmount || !isQuoteCurrent);
  const liveQuote = isQuoteCurrent ? quote : undefined;

  // Limits are fiat-denominated (e.g. 659–30,000 BDT), so they must be compared
  // against the fiat total, never against the USDC amount being bought.
  const fiatTotal = liveQuote?.fiatAmount;
  const belowMin =
    liveQuote?.minLimit != null && fiatTotal != null && fiatTotal < liveQuote.minLimit;
  const aboveMax =
    liveQuote?.maxLimit != null && fiatTotal != null && fiatTotal > liveQuote.maxLimit;
  const isValid =
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    !isQuotePending &&
    !!liveQuote &&
    !belowMin &&
    !aboveMax &&
    !!activePaymentCode &&
    !!currency;

  const selectedMethod = useMemo(
    () => methods?.find(m => m.paymentCode === activePaymentCode),
    [methods, activePaymentCode],
  );
  const selectedCurrency = useMemo(
    () => config?.currencies.find(c => c.currency === currency),
    [config?.currencies, currency],
  );

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
          track(TRACKING_EVENTS.BUY_CRYPTO_ORDER_CREATION_FAILED, {
            usdc_amount: Number(amount),
            currency,
            payment_code: activePaymentCode,
            error_message: error instanceof Error ? error.message : 'Unknown error',
          });
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
    <View className="flex-1 gap-3">
      {/* Amount input (swap-style: number left, fixed USDC pill right) */}
      <View className="rounded-2xl bg-card p-5">
        <Text className="mb-2 text-sm text-muted-foreground">You buy</Text>
        <View className="flex-row items-center justify-between gap-3">
          <TextInput
            value={amount}
            onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#6B7280"
            // w-0/min-w-0 so the input yields to the token pill instead of
            // pushing it out of the row (a web <input> won't shrink past its
            // intrinsic width on flex-1 alone); no focus ring on web.
            className="w-0 min-w-0 flex-1 bg-transparent text-4xl font-bold text-primary web:outline-none"
          />
          <View className="shrink-0 flex-row items-center gap-2 rounded-full border border-border px-3 py-2">
            {/* Our own USDC mark, not TransFi's: theirs badges the delivery
                network onto the coin, so the pill read USDC-on-Ethereum. The
                network belongs in the line below, once, not on the icon. */}
            <Image
              source={getAsset('images/usdc-4x.png')}
              style={TOKEN_PILL_ICON_STYLE}
              contentFit="contain"
            />
            <Text className="text-base font-semibold text-primary">
              {config?.tokenSymbol ?? 'USDC'}
            </Text>
          </View>
        </View>
        <Text className="mt-2 text-sm text-muted-foreground">{receiveLine}</Text>
      </View>

      {/* Pay in — currency selector (opens a step) */}
      <SelectorRow
        label="Pay in"
        value={currency ?? 'Select currency'}
        logoUrl={selectedCurrency?.logoUrl}
        onPress={() => setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_CURRENCY)}
      />

      {/* Pay with — payment method selector (opens a step) */}
      <SelectorRow
        label="Pay with"
        value={selectedMethod?.paymentName ?? selectedMethod?.paymentCode ?? 'Select method'}
        logoUrl={selectedMethod?.logo}
        onPress={() => setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT_METHOD)}
        disabled={!currency}
      />

      {/* Quote breakdown */}
      <View className="gap-3 rounded-2xl bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-muted-foreground">Quote</Text>
          {isQuotePending ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#94F27F" />
              <Text className="text-xs text-muted-foreground">Updating…</Text>
            </View>
          ) : null}
        </View>
        <QuoteRow
          label="Rate"
          pending={isQuotePending}
          value={
            liveQuote?.exchangeRate != null
              ? `1 USDC ≈ ${liveQuote.exchangeRate} ${currency ?? ''}`
              : '—'
          }
        />
        <QuoteRow
          label="Fees"
          pending={isQuotePending}
          value={formatFiat(liveQuote?.totalFee, currency ?? '')}
        />
        <View className="h-px bg-border" />
        <QuoteRow
          label="Total you pay"
          pending={isQuotePending}
          value={formatFiat(liveQuote?.fiatAmount, currency ?? '')}
          emphasize
        />
        {/* Limits depend only on the currency + method, so they stay accurate
            while a new amount's quote is in flight. */}
        {quote?.minLimit != null || quote?.maxLimit != null ? (
          <Text className="text-xs text-muted-foreground">
            Limits: {formatFiat(quote?.minLimit, currency ?? '')} –{' '}
            {formatFiat(quote?.maxLimit, currency ?? '')}
          </Text>
        ) : null}
        {belowMin ? (
          <Text className="text-xs text-red-500">
            Amount is below the {formatFiat(liveQuote?.minLimit, currency ?? '')} minimum.
          </Text>
        ) : null}
        {aboveMax ? (
          <Text className="text-xs text-red-500">
            Amount is above the {formatFiat(liveQuote?.maxLimit, currency ?? '')} maximum.
          </Text>
        ) : null}
      </View>

      <Text className="px-1 text-xs text-muted-foreground">
        Crypto purchases are provided by TransFi. Rates and fees are set by TransFi and may change.
      </Text>

      <Button
        className="mt-auto h-14 rounded-2xl"
        variant="brand"
        onPress={handleContinue}
        disabled={!isValid || creatingOrder}
      >
        <Text className="text-base font-bold text-primary-foreground">
          {creatingOrder
            ? 'Creating order…'
            : isQuotePending
              ? 'Getting quote…'
              : 'Continue to payment'}
        </Text>
      </Button>
    </View>
  );
};

const SelectorRow = ({
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
  <Pressable
    className="flex-row items-center justify-between rounded-2xl bg-card p-4"
    onPress={onPress}
    disabled={disabled}
    style={{ opacity: disabled ? 0.5 : 1 }}
  >
    <View className="flex-1">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <View className="mt-0.5 flex-row items-center gap-2">
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={{ width: 18, height: 18 }} contentFit="contain" />
        ) : null}
        <Text className="text-base font-semibold text-primary">{value}</Text>
      </View>
    </View>
    <ChevronRight size={20} color="#9CA3AF" />
  </Pressable>
);

const QuoteRow = ({
  label,
  value,
  emphasize,
  pending,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  /** A newer quote is in flight — dim the value rather than showing it as final. */
  pending?: boolean;
}) => (
  <View className="flex-row items-center justify-between">
    <Text
      className={
        emphasize ? 'text-base font-semibold text-primary' : 'text-sm text-muted-foreground'
      }
    >
      {label}
    </Text>
    <Text
      className={emphasize ? 'text-base font-bold text-primary' : 'text-sm text-primary'}
      style={{ opacity: pending ? 0.4 : 1 }}
    >
      {pending ? '—' : value}
    </Text>
  </View>
);

export default TransfiAmount;
