import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { formatUnits, parseUnits } from 'viem';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { useCashoutUsdc } from '@/hooks/useCashout';
import {
  bridgePlanMessage,
  cashoutBridgeMaxQuery,
  useCashoutBridge,
  useCashoutBridgePlan,
} from '@/hooks/useCashoutBridge';
import useDebounce from '@/hooks/useDebounce';
import {
  cashoutQuoteQuery,
  useTransfiCashoutConfig,
  useTransfiCashoutLimits,
  useTransfiCashoutQuote,
} from '@/hooks/useTransfiCashout';
import { getAsset } from '@/lib/assets';
import { bridgeShortfall } from '@/lib/cashoutBridge';
import { formatCashoutFiat, formatCashoutRate } from '@/lib/cashoutFormat';
import {
  formatLimit,
  isLimitProblem,
  maxCashoutWei,
  toLimitUnits,
  validateCashoutAmount,
} from '@/lib/cashoutLimits';
import { asTransfiError, TransfiError } from '@/lib/transfiErrors';
import { cn, formatNumber } from '@/lib/utils';
import { formatLD } from '@/lib/utils/cross-chain-send';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';

import type { TextInputProps } from 'react-native';

const QUOTE_DEBOUNCE_MS = 500;

/** The line under the field: where it sends from, or what is wrong with the amount. */
const MESSAGE_ID = 'cashout-amount-message';

/** Parse what's in the box as token units, or undefined when it isn't a number yet. */
const toWei = (amount: string, decimals: number): bigint | undefined => {
  try {
    return amount ? parseUnits(amount, decimals) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * `aria-invalid` and `aria-describedby` reach the DOM through react-native-web,
 * but React Native's types don't list them, and native has no equivalent — so
 * there the message is read out as the field's hint instead.
 */
const amountFieldA11y = (error: string | undefined): Partial<TextInputProps> =>
  Platform.OS === 'web'
    ? ({
        'aria-invalid': Boolean(error),
        'aria-describedby': MESSAGE_ID,
      } as Partial<TextInputProps>)
    : { accessibilityHint: error };

/**
 * Fourth cash-out step: how much USDC to send, with the live payout quote.
 *
 * The amount is in USDC because that is what leaves the wallet. The balance
 * is the USDC on the chain the cash-out sends from plus, when the bridge can
 * move it, the USDC on Fuse: an amount past the first is topped up from the
 * second before the order is opened (see lib/cashoutBridge).
 *
 * TransFi's limits for the payout method are fetched as soon as the screen
 * opens and checked on the keystroke, so an amount TransFi would refuse is
 * caught before it is quoted rather than after.
 */
export const CashoutAmount = () => {
  const queryClient = useQueryClient();
  const setModal = useSendStore(state => state.setModal);
  const currency = useCashoutStore(state => state.currency);
  const paymentCode = useCashoutStore(state => state.paymentCode);
  const amount = useCashoutStore(state => state.usdcAmount);
  const setAmount = useCashoutStore(state => state.setUsdcAmount);

  const { data: config } = useTransfiCashoutConfig();
  const {
    balanceWei: baseWei,
    decimals = 6,
    isLoading: baseLoading,
  } = useCashoutUsdc(config?.chainId);
  const { source: bridge, isLoading: bridgeLoading } = useCashoutBridge(config?.chainId);
  const { data: limits, isLoading: limitsLoading } = useTransfiCashoutLimits(currency, paymentCode);

  const balanceLoading = baseLoading || bridgeLoading;
  const balanceWei = baseWei != null ? baseWei + (bridge?.balanceWei ?? 0n) : undefined;
  const balance = balanceWei != null ? Number(formatUnits(balanceWei, decimals)) : 0;
  const network = config?.tokenNetwork ?? 'Base';
  const currencyLabel = currency ?? '';
  const limitUnits = useMemo(
    () => (limits ? toLimitUnits(limits, decimals) : undefined),
    [limits, decimals],
  );
  // Not before the balance has loaded: an empty wallet list reads as zero.
  const knownBalanceWei = balanceLoading ? undefined : balanceWei;
  const validate = (value: string) =>
    validateCashoutAmount({
      amountWei: toWei(value, decimals),
      balanceWei: knownBalanceWei,
      limits: limitUnits,
      decimals,
    });

  const problem = validate(amount);

  // Quote only a settled amount that passes: anything else would be refused,
  // and every quote is a TransFi call.
  const debouncedAmount = useDebounce(amount, QUOTE_DEBOUNCE_MS);
  const {
    data: quote,
    isFetching,
    error: quoteError,
  } = useTransfiCashoutQuote(debouncedAmount, currency, paymentCode, !validate(debouncedAmount));

  const amountWei = toWei(amount, decimals);
  const isQuoteCurrent = quote != null && Number(quote.usdcAmount) === Number(amount);
  const liveQuote = isQuoteCurrent && !problem ? quote : undefined;

  // What the Base balance doesn't cover comes from Fuse, priced on the settled
  // amount like the payout quote.
  const shortfallWei = bridge ? bridgeShortfall(amountWei, baseWei ?? 0n) : 0n;
  const settledShortfallWei = bridge
    ? bridgeShortfall(toWei(debouncedAmount, decimals), baseWei ?? 0n)
    : 0n;
  const {
    data: bridgePlan,
    isFetching: isPlanFetching,
    error: planError,
  } = useCashoutBridgePlan(
    config?.chainId,
    settledShortfallWei,
    bridge,
    !validate(debouncedAmount),
  );
  const needsBridge = shortfallWei > 0n;
  const bridgeError =
    needsBridge && planError && amount === debouncedAmount
      ? bridgePlanMessage(planError)
      : undefined;
  const isPlanPending =
    needsBridge && !problem && !planError && (isPlanFetching || amount !== debouncedAmount);

  // An amount the checks let through can still be refused — limits that failed
  // to load, or that changed since. A refusal with limits updates them (and so
  // `problem`); one without is still about the amount, so it goes on the field.
  const refusedAmount =
    quoteError instanceof TransfiError &&
    quoteError.action === 'adjust_amount' &&
    amount === debouncedAmount
      ? quoteError
      : undefined;
  const fieldError = problem?.message ?? refusedAmount?.message ?? bridgeError;
  const quoteFailure =
    quoteError && !refusedAmount && !problem ? asTransfiError(quoteError).message : undefined;
  const isQuotePending =
    (amountWei != null &&
      amountWei > 0n &&
      !problem &&
      !quoteError &&
      (isFetching || amount !== debouncedAmount || !isQuoteCurrent)) ||
    isPlanPending;

  const [checking, setChecking] = useState(false);
  const canReview =
    !!liveQuote &&
    !isQuotePending &&
    !fieldError &&
    !quoteFailure &&
    !checking &&
    (!needsBridge || !!bridgePlan);

  /**
   * The quote on screen may be minutes old, so Review prices the amount again
   * and checks it against the limits that come back before moving on. A
   * refusal needs no handling here: its limits land in the cache and the
   * screen shows the problem; any other failure is the quote's error.
   */
  const handleReview = async () => {
    if (!canReview) return;
    setChecking(true);
    try {
      const fresh = await queryClient.fetchQuery({
        ...cashoutQuoteQuery(queryClient, amount, currency, paymentCode),
        staleTime: 0,
      });
      const freshLimits =
        fresh.minLimit != null && fresh.maxLimit != null
          ? toLimitUnits({ minLimit: fresh.minLimit, maxLimit: fresh.maxLimit }, decimals)
          : limitUnits;
      const recheck = validateCashoutAmount({
        amountWei,
        balanceWei: knownBalanceWei,
        limits: freshLimits,
        decimals,
      });
      if (!recheck) setModal(SEND_MODAL.OPEN_CASHOUT_REVIEW);
    } catch {
      // Shown through the quote query's error state.
    } finally {
      setChecking(false);
    }
  };

  const [fillingMax, setFillingMax] = useState(false);
  const canUseMax = knownBalanceWei != null && problem?.kind !== 'balance_below_min' && !fillingMax;
  /**
   * The Base balance plus what moving the most allowed from Fuse would land:
   * the bridge's fee comes out of the Fuse side, so the whole balance can't be
   * cashed out. Without that price, Max fills the Base balance alone.
   */
  const handleMax = async () => {
    if (knownBalanceWei == null || !canUseMax || baseWei == null) return;
    let maxWei = baseWei;
    if (bridge && config?.chainId) {
      setFillingMax(true);
      try {
        const landed = await queryClient.fetchQuery(cashoutBridgeMaxQuery(config.chainId, bridge));
        maxWei += BigInt(landed.amountReceivedLD);
      } catch {
        // Max covers the Base balance only.
      } finally {
        setFillingMax(false);
      }
    }
    setAmount(formatUnits(maxCashoutWei(maxWei, limitUnits), decimals));
  };

  // "—" while loading; no row at all when they couldn't be fetched.
  const limitsValue = !paymentCode
    ? undefined
    : limitUnits
      ? `${formatLimit(limitUnits.min, decimals, 'up')} – ${formatLimit(limitUnits.max, decimals, 'down')} USDC per cash-out`
      : limitsLoading
        ? '—'
        : undefined;

  return (
    <View className="gap-6">
      <View className="gap-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-medium opacity-70">You send</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use maximum amount"
            accessibilityState={{ disabled: !canUseMax }}
            disabled={!canUseMax}
            onPress={() => void handleMax()}
            className={cn('flex-row items-center gap-2', !canUseMax && 'opacity-50')}
          >
            <Text className="text-sm text-white/50">
              {balanceLoading ? 'Loading balance…' : `Balance ${formatNumber(balance, 2, 0)} USDC`}
            </Text>
            <View className="rounded-full bg-white/10 px-2 py-0.5">
              <Text className="text-xs font-semibold">Max</Text>
            </View>
          </Pressable>
        </View>
        {/* The chip is a fixed-size flex child inside the field's 12px right
            inset; the input takes what is left and may shrink to nothing, so
            neither can be pushed past the edge at any width. */}
        <View
          className={cn(
            'h-[80px] flex-row items-center gap-3 overflow-hidden rounded-2xl border bg-card pl-4 pr-3',
            fieldError ? 'border-warning' : 'border-transparent',
          )}
        >
          <View className="min-w-0 flex-1">
            <TextInput
              accessibilityLabel="USDC amount"
              {...amountFieldA11y(fieldError)}
              value={amount}
              onChangeText={text => setAmount(text.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor="rgba(255,255,255,0.5)"
              className="w-full p-0 text-3xl font-semibold text-white web:outline-none"
              style={{ fontFamily: 'MonaSans_600SemiBold' }}
            />
          </View>
          <View className="h-12 shrink-0 flex-row items-center gap-[7px] rounded-full bg-white/10 px-3">
            <Image
              source={getAsset('images/usdc-4x.png')}
              style={{ width: 24, height: 24 }}
              contentFit="contain"
            />
            <Text className="text-lg font-semibold text-white">USDC</Text>
          </View>
        </View>
        <Text
          nativeID={MESSAGE_ID}
          aria-live="polite"
          className={cn('text-sm', fieldError ? 'text-warning' : 'text-white/70')}
        >
          {fieldError ??
            (needsBridge
              ? `${formatLD(shortfallWei.toString())} USDC moves from Fuse to ${network} first. Takes about ${bridge?.etaMinutes} min.`
              : `Sent from your wallet on ${network}`)}
        </Text>
        {bridge ? (
          <View className="gap-2.5 rounded-2xl bg-card p-4">
            <Row label={`On ${network}`} value={`${formatLD((baseWei ?? 0n).toString())} USDC`} />
            <Row label="On Fuse" value={`${formatLD(bridge.balanceWei.toString())} USDC`} />
          </View>
        ) : null}
      </View>

      <View className="gap-2.5 rounded-2xl bg-card p-4">
        <Text className="text-base font-semibold text-white">You receive</Text>
        {liveQuote ? (
          <Text className="text-3xl font-semibold text-brand">
            {formatCashoutFiat(liveQuote.fiatAmount, currencyLabel)}
          </Text>
        ) : fieldError ? (
          <Text className="text-3xl font-semibold text-muted-foreground">— {currencyLabel}</Text>
        ) : isQuotePending ? (
          <View className="min-h-10 flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#94F27F" />
            <Text className="text-sm text-white/70">Getting your rate and fees…</Text>
          </View>
        ) : (
          <Text className="text-sm text-white/70">Enter an amount to see what you’ll receive.</Text>
        )}
        <Row label="Rate" value={liveQuote ? formatCashoutRate(liveQuote, currencyLabel) : '—'} />
        <Row
          label="Fees"
          value={liveQuote ? formatCashoutFiat(liveQuote.totalFee, currencyLabel) : '—'}
        />
        {limitsValue ? (
          <Row label="Limits" value={limitsValue} warning={isLimitProblem(problem)} />
        ) : null}
        {quoteFailure ? <Text className="text-sm text-destructive">{quoteFailure}</Text> : null}
      </View>

      <View className="gap-3">
        <Text className="text-xs text-white/50">
          Cash-outs are provided by TransFi. Rates, fees and limits are set by TransFi and may
          change.
        </Text>
        <Button
          variant="brand"
          className="h-12 rounded-xl"
          size="lg"
          disabled={!canReview}
          onPress={handleReview}
        >
          <Text className="text-base font-bold text-black">
            {isQuotePending || checking ? 'Getting quote…' : 'Review'}
          </Text>
        </Button>
      </View>
    </View>
  );
};

const Row = ({ label, value, warning }: { label: string; value: string; warning?: boolean }) => (
  <View className="flex-row items-center justify-between gap-4">
    <Text className="text-sm text-muted-foreground">{label}</Text>
    <Text className={cn('shrink text-right text-sm', warning ? 'text-warning' : 'text-primary')}>
      {value}
    </Text>
  </View>
);

export default CashoutAmount;
