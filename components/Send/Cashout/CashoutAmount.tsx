import { useMemo } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { formatUnits, parseUnits } from 'viem';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { useCashoutUsdc } from '@/hooks/useCashout';
import useDebounce from '@/hooks/useDebounce';
import { useTransfiCashoutConfig, useTransfiCashoutQuote } from '@/hooks/useTransfiCashout';
import { getAsset } from '@/lib/assets';
import { formatCashoutFiat, formatCashoutRate } from '@/lib/cashoutFormat';
import { asTransfiError, TransfiError } from '@/lib/transfiErrors';
import { formatNumber } from '@/lib/utils';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';

const QUOTE_DEBOUNCE_MS = 500;

/** Parse what's in the box as token units, or undefined when it isn't a number yet. */
const toWei = (amount: string, decimals: number): bigint | undefined => {
  try {
    return amount ? parseUnits(amount, decimals) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Fourth cash-out step: how much USDC to send, with the live payout quote.
 *
 * The amount is in USDC because that is what leaves the wallet — and only the
 * USDC on the chain the cash-out sends from counts, so the balance shown is
 * that one, not the user's total.
 */
export const CashoutAmount = () => {
  const setModal = useSendStore(state => state.setModal);
  const currency = useCashoutStore(state => state.currency);
  const paymentCode = useCashoutStore(state => state.paymentCode);
  const amount = useCashoutStore(state => state.usdcAmount);
  const setAmount = useCashoutStore(state => state.setUsdcAmount);

  const { data: config } = useTransfiCashoutConfig();
  const { balanceWei, decimals = 6, isLoading: balanceLoading } = useCashoutUsdc(config?.chainId);

  const debouncedAmount = useDebounce(amount, QUOTE_DEBOUNCE_MS);
  const {
    data: quote,
    isFetching,
    error: quoteError,
  } = useTransfiCashoutQuote(debouncedAmount, currency, paymentCode);

  const amountNum = Number(amount);
  const amountWei = toWei(amount, decimals);
  const isQuoteCurrent = quote != null && Number(quote.usdcAmount) === amountNum;
  const liveQuote = isQuoteCurrent ? quote : undefined;
  const isQuotePending =
    amountNum > 0 && !quoteError && (isFetching || amount !== debouncedAmount || !isQuoteCurrent);

  const balance = balanceWei != null ? Number(formatUnits(balanceWei, decimals)) : 0;
  // Not before the balance has loaded: an empty wallet list reads as zero.
  const overBalance =
    !balanceLoading && amountWei != null && balanceWei != null && amountWei > balanceWei;
  const belowMin = liveQuote?.minLimit != null && amountNum < liveQuote.minLimit;
  const aboveMax = liveQuote?.maxLimit != null && amountNum > liveQuote.maxLimit;
  const limitError =
    quoteError instanceof TransfiError && quoteError.action === 'adjust_amount'
      ? quoteError
      : undefined;

  const problem = useMemo(() => {
    if (overBalance) {
      return `You have ${formatNumber(balance, 2, 0)} USDC on ${config?.tokenNetwork ?? 'Base'} to cash out. Move USDC from Savings or another network to your wallet on ${config?.tokenNetwork ?? 'Base'} first.`;
    }
    if (belowMin) return `Cash out at least ${formatNumber(liveQuote?.minLimit ?? 0, 2, 0)} USDC.`;
    if (aboveMax) return `Cash out at most ${formatNumber(liveQuote?.maxLimit ?? 0, 2, 0)} USDC.`;
    if (limitError) return limitError.message;
    if (quoteError) return asTransfiError(quoteError).message;
    return undefined;
  }, [
    overBalance,
    balance,
    config?.tokenNetwork,
    belowMin,
    aboveMax,
    liveQuote,
    limitError,
    quoteError,
  ]);

  const canContinue =
    amountNum > 0 && !!liveQuote && !isQuotePending && !problem && amountWei != null;

  const handleMax = () => {
    if (balanceWei == null) return;
    setAmount(formatUnits(balanceWei, decimals));
  };

  return (
    <View className="gap-6">
      <View className="gap-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-medium opacity-70">You send</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use maximum balance"
            onPress={handleMax}
            className="flex-row items-center gap-2"
          >
            <Text className="text-sm text-white/50">
              {balanceLoading ? 'Loading balance…' : `Balance ${formatNumber(balance, 2, 0)} USDC`}
            </Text>
            <View className="rounded-full bg-white/10 px-2 py-0.5">
              <Text className="text-xs font-semibold">Max</Text>
            </View>
          </Pressable>
        </View>
        <View className="h-[80px] flex-row items-center justify-between rounded-2xl bg-card pl-4 pr-3.5">
          <TextInput
            accessibilityLabel="USDC amount"
            value={amount}
            onChangeText={text => setAmount(text.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor="rgba(255,255,255,0.5)"
            className="mr-3 flex-1 p-0 text-3xl font-semibold text-white web:outline-none"
            style={{ fontFamily: 'MonaSans_600SemiBold' }}
          />
          <View className="h-12 flex-row items-center gap-[7px] rounded-full bg-white/10 px-3">
            <Image
              source={getAsset('images/usdc-4x.png')}
              style={{ width: 24, height: 24 }}
              contentFit="contain"
            />
            <Text className="text-lg font-semibold text-white">USDC</Text>
          </View>
        </View>
        <Text className="text-sm text-white/70">
          Sent from your wallet on {config?.tokenNetwork ?? 'Base'}
        </Text>
      </View>

      <View className="gap-2 rounded-2xl bg-card p-4">
        <Text className="text-base font-semibold text-white">You receive</Text>
        {liveQuote ? (
          <View className="gap-2.5">
            <Text className="text-3xl font-semibold text-brand">
              {formatCashoutFiat(liveQuote.fiatAmount, currency ?? '')}
            </Text>
            <Row label="Rate" value={formatCashoutRate(liveQuote, currency ?? '')} />
            <Row label="Fees" value={formatCashoutFiat(liveQuote.totalFee, currency ?? '')} />
          </View>
        ) : isQuotePending ? (
          <View className="min-h-10 flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#94F27F" />
            <Text className="text-sm text-white/70">Getting your rate and fees…</Text>
          </View>
        ) : (
          <Text className="text-sm text-white/70">Enter an amount to see what you’ll receive.</Text>
        )}
        {problem ? <Text className="text-sm text-red-400">{problem}</Text> : null}
      </View>

      <View className="gap-3">
        <Text className="text-xs text-white/50">
          Cash-outs are provided by TransFi. Rates and fees are set by TransFi and may change.
        </Text>
        <Button
          variant="brand"
          className="h-12 rounded-xl"
          size="lg"
          disabled={!canContinue}
          onPress={() => setModal(SEND_MODAL.OPEN_CASHOUT_REVIEW)}
        >
          <Text className="text-base font-bold text-black">
            {isQuotePending ? 'Getting quote…' : 'Review'}
          </Text>
        </Button>
      </View>
    </View>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row items-center justify-between">
    <Text className="text-sm text-muted-foreground">{label}</Text>
    <Text className="text-sm text-primary">{value}</Text>
  </View>
);

export default CashoutAmount;
