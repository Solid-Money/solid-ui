import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, ChevronDown } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import {
  useCreateTransfiOrder,
  useTransfiPaymentConfig,
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
 * Primary buy-crypto screen: enter a USDC amount, see the live local-currency
 * quote (rate + fees + total) and pick a payment method, then create the order.
 */
export const TransfiAmount = () => {
  const setModal = useDepositStore(state => state.setModal);
  const setOrder = useTransfiStore(state => state.setOrder);
  const setStoreAmount = useTransfiStore(state => state.setAmount);
  const setStorePaymentCode = useTransfiStore(state => state.setPaymentCode);
  const setStoreCurrency = useTransfiStore(state => state.setFiatCurrency);

  const { data: config, isLoading: configLoading } = useTransfiPaymentConfig();
  const [amount, setAmount] = useState('');
  const [paymentCode, setPaymentCode] = useState<string | undefined>(undefined);
  const [showMethods, setShowMethods] = useState(false);

  const activePaymentCode = paymentCode ?? config?.paymentMethods[0]?.paymentCode;
  const fiatCurrency = config?.fiatCurrency ?? '';

  const { data: quote, isFetching: quoteFetching } = useTransfiQuote(
    amount,
    activePaymentCode,
    Boolean(config),
  );

  const { mutate: createOrder, isPending: creatingOrder } = useCreateTransfiOrder();

  const amountNum = Number(amount);
  const belowMin = quote?.minLimit != null && amountNum > 0 && amountNum < quote.minLimit;
  const aboveMax = quote?.maxLimit != null && amountNum > quote.maxLimit;
  const isValid =
    Number.isFinite(amountNum) && amountNum > 0 && !belowMin && !aboveMax && !!activePaymentCode;

  const selectedMethod = useMemo(
    () => config?.paymentMethods.find(m => m.paymentCode === activePaymentCode),
    [config?.paymentMethods, activePaymentCode],
  );

  const handleContinue = () => {
    if (!isValid || !activePaymentCode) return;
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'buy_crypto' });
    setStoreAmount(amount);
    setStorePaymentCode(activePaymentCode);
    if (fiatCurrency) setStoreCurrency(fiatCurrency);
    createOrder(
      { usdcAmount: amount, paymentCode: activePaymentCode },
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
    <View className="flex-1 gap-5">
      {/* Amount input */}
      <View className="items-center gap-2 rounded-2xl bg-card p-6">
        <Text className="text-sm text-muted-foreground">You buy</Text>
        <View className="flex-row items-center gap-2">
          <TextInput
            value={amount}
            onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#6B7280"
            className="min-w-[60px] text-center text-4xl font-bold text-primary"
          />
          <View className="flex-row items-center gap-1">
            {config?.tokenLogo ? (
              <Image
                source={{ uri: config.tokenLogo }}
                style={{ width: 24, height: 24 }}
                contentFit="contain"
              />
            ) : null}
            <Text className="text-2xl font-bold text-primary">{config?.tokenSymbol ?? 'USDC'}</Text>
          </View>
        </View>
        <Text className="text-sm text-muted-foreground">You&apos;ll receive USDC on Ethereum</Text>
      </View>

      {/* Payment method selector */}
      <View className="rounded-2xl bg-card">
        <Pressable
          className="flex-row items-center justify-between p-4"
          onPress={() => setShowMethods(v => !v)}
        >
          <View>
            <Text className="text-sm text-muted-foreground">Pay with</Text>
            <Text className="text-base font-semibold text-primary">
              {selectedMethod?.paymentName ?? selectedMethod?.paymentCode ?? 'Select method'}
            </Text>
          </View>
          <ChevronDown size={20} color="#9CA3AF" />
        </Pressable>
        {showMethods
          ? config?.paymentMethods.map(m => (
              <Pressable
                key={m.paymentCode}
                className="flex-row items-center justify-between border-t border-border px-4 py-3"
                onPress={() => {
                  setPaymentCode(m.paymentCode);
                  setShowMethods(false);
                }}
              >
                <Text className="text-base text-primary">{m.paymentName ?? m.paymentCode}</Text>
                {m.paymentCode === activePaymentCode ? <Check size={16} color="#94F27F" /> : null}
              </Pressable>
            ))
          : null}
      </View>

      {/* Quote breakdown */}
      <View className="gap-3 rounded-2xl bg-card p-4">
        <QuoteRow
          label="Rate"
          value={
            quote?.exchangeRate != null
              ? `1 USDC ≈ ${quote.exchangeRate} ${fiatCurrency}`
              : quoteFetching
                ? '…'
                : '—'
          }
        />
        <QuoteRow label="Fees" value={formatFiat(quote?.totalFee, fiatCurrency)} />
        <View className="h-px bg-border" />
        <QuoteRow
          label="Total you pay"
          value={quoteFetching ? '…' : formatFiat(quote?.fiatAmount, fiatCurrency)}
          emphasize
        />
        {quote?.minLimit != null || quote?.maxLimit != null ? (
          <Text className="text-xs text-muted-foreground">
            Limits: {formatFiat(quote?.minLimit, fiatCurrency)} –{' '}
            {formatFiat(quote?.maxLimit, fiatCurrency)}
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
