import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import {
  useCreateTransfiOrder,
  useTransfiPaymentConfig,
  useTransfiPaymentMethods,
  useTransfiQuote,
} from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

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

  const { data: quote, isFetching: quoteFetching } = useTransfiQuote(
    amount,
    currency ?? undefined,
    activePaymentCode,
    Boolean(config),
  );

  const { mutate: createOrder, isPending: creatingOrder } = useCreateTransfiOrder();

  const amountNum = Number(amount);
  const belowMin = quote?.minLimit != null && amountNum > 0 && amountNum < quote.minLimit;
  const aboveMax = quote?.maxLimit != null && amountNum > quote.maxLimit;
  const isValid =
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
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

  const handleContinue = () => {
    if (!isValid || !activePaymentCode || !currency) return;
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'buy_crypto' });
    createOrder(
      { usdcAmount: amount, paymentCode: activePaymentCode, currency },
      {
        onSuccess: order => {
          setOrder({ orderId: order.orderId, payUrl: order.payUrl });
          setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT);
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
            className="flex-1 text-4xl font-bold text-primary"
          />
          <View className="flex-row items-center gap-2 rounded-full border border-border px-3 py-2">
            {config?.tokenLogo ? (
              <Image
                source={{ uri: config.tokenLogo }}
                style={{ width: 20, height: 20 }}
                contentFit="contain"
              />
            ) : null}
            <Text className="text-base font-semibold text-primary">
              {config?.tokenSymbol ?? 'USDC'}
            </Text>
          </View>
        </View>
        <Text className="mt-2 text-sm text-muted-foreground">
          You&apos;ll receive USDC on Ethereum
        </Text>
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
        <QuoteRow
          label="Rate"
          value={
            quote?.exchangeRate != null
              ? `1 USDC ≈ ${quote.exchangeRate} ${currency ?? ''}`
              : quoteFetching
                ? '…'
                : '—'
          }
        />
        <QuoteRow label="Fees" value={formatFiat(quote?.totalFee, currency ?? '')} />
        <View className="h-px bg-border" />
        <QuoteRow
          label="Total you pay"
          value={quoteFetching ? '…' : formatFiat(quote?.fiatAmount, currency ?? '')}
          emphasize
        />
        {quote?.minLimit != null || quote?.maxLimit != null ? (
          <Text className="text-xs text-muted-foreground">
            Limits: {formatFiat(quote?.minLimit, currency ?? '')} –{' '}
            {formatFiat(quote?.maxLimit, currency ?? '')}
          </Text>
        ) : null}
        {belowMin ? (
          <Text className="text-xs text-red-500">Amount is below the minimum.</Text>
        ) : null}
        {aboveMax ? (
          <Text className="text-xs text-red-500">Amount is above the maximum.</Text>
        ) : null}
      </View>

      <Text className="px-1 text-xs text-muted-foreground">
        Crypto purchases are provided by TransFi. Rates and fees are set by TransFi and may change.
      </Text>

      <Button
        className="mt-auto h-14 rounded-2xl"
        variant="brand"
        onPress={handleContinue}
        disabled={!isValid || creatingOrder || quoteFetching}
      >
        <Text className="text-base font-bold text-primary-foreground">
          {creatingOrder ? 'Creating order…' : 'Continue to payment'}
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
