import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { WirexBankTransferEstimateDto, WirexEstimatedAmountDto } from '@/lib/types/wirex-bank';
import { cn } from '@/lib/utils';

/** Re-quote this long before the estimate actually expires. */
const EXPIRY_WARNING_MS = 30_000;

/** One label/value line in the summary card. */
const SummaryRow = ({
  label,
  value,
  withDivider = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  withDivider?: boolean;
  emphasis?: boolean;
}) => (
  <View>
    <View className="flex-row items-center justify-between" style={styles.summaryRow}>
      <Text className="text-[14px] leading-5 text-white/70">{label}</Text>
      <Text
        className={cn(
          'ml-4 flex-1 text-right leading-5 text-white',
          emphasis ? 'text-[16px] font-semibold' : 'text-[14px]',
        )}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
    {withDivider && <View style={styles.divider} />}
  </View>
);

/** One payable token, with what it would cost. */
const TokenOption = ({
  option,
  currency,
  fiatAmount,
  isSelected,
  onPress,
}: {
  option: WirexEstimatedAmountDto;
  currency: string;
  fiatAmount: number;
  isSelected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected: isSelected }}
    onPress={onPress}
    style={styles.tokenOption}
    className={cn('flex-row items-center rounded-twice bg-card', isSelected && 'bg-white/10')}
  >
    <View className="flex-1 gap-0.5">
      <Text className="text-[16px] font-medium text-white">{option.tokenSymbol}</Text>
      <Text className="text-[13px] leading-4 text-white/60">
        {/* The rate is tokens per unit of fiat, so 1.0 means no conversion. */}
        {option.rate === 1
          ? 'No conversion'
          : `1 ${currency} ≈ ${option.rate.toFixed(4)} ${option.tokenSymbol}`}
      </Text>
    </View>
    <View className="items-end gap-0.5">
      <Text className="text-[16px] font-semibold text-white">
        {formatAmount(option.amount)} {option.tokenSymbol}
      </Text>
      <Text className="text-[13px] leading-4 text-white/60">
        for {formatAmount(fiatAmount)} {currency}
      </Text>
    </View>
    {isSelected ? (
      <View className="ml-3">
        <Check size={18} color="#ffffff" />
      </View>
    ) : null}
  </Pressable>
);

export interface WirexBankTransferReviewProps {
  estimate: WirexBankTransferEstimateDto;
  recipientName: string;
  /** Masked for display — the full number is on the previous screen. */
  recipientAccountDisplay: string;
  reference?: string;
  selectedTokenAddress?: string;
  onSelectToken: (tokenAddress: string) => void;
  /** Called once the quote is within {@link EXPIRY_WARNING_MS} of expiring. */
  onExpiring?: () => void;
}

/**
 * Confirm screen: what is being sent, to whom, and which token pays for it.
 *
 * The token choice matters — Wirex prices the same fiat amount against every
 * token the user holds, and the rates differ, so this is a real decision rather
 * than a formality.
 */
export const WirexBankTransferReview = ({
  estimate,
  recipientName,
  recipientAccountDisplay,
  reference,
  selectedTokenAddress,
  onSelectToken,
  onExpiring,
}: WirexBankTransferReviewProps) => {
  const [isExpiring, setIsExpiring] = useState(false);

  const expiresAtMs = useMemo(() => new Date(estimate.expiresAt).getTime(), [estimate.expiresAt]);

  /**
   * Warn before the quote goes stale.
   *
   * Executing against an expired estimation id fails at Wirex, and the user
   * would have no idea why — so the countdown surfaces here instead.
   */
  useEffect(() => {
    setIsExpiring(false);
    const msUntilWarning = expiresAtMs - Date.now() - EXPIRY_WARNING_MS;
    const timer = setTimeout(
      () => {
        setIsExpiring(true);
        onExpiring?.();
      },
      Math.max(msUntilWarning, 0),
    );
    return () => clearTimeout(timer);
  }, [expiresAtMs, onExpiring]);

  const options = estimate.estimatedAmounts;

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-5 pb-8"
      showsVerticalScrollIndicator={false}
    >
      <View className="items-center gap-1 pt-2">
        <Text className="text-[32px] font-semibold leading-9 text-white">
          {formatAmount(estimate.amount)} {estimate.currency}
        </Text>
        <Text className="text-[15px] text-white/60">to {recipientName}</Text>
      </View>

      <View className="overflow-hidden rounded-twice bg-card">
        <SummaryRow label="To" value={recipientName} withDivider />
        <SummaryRow label="Account" value={recipientAccountDisplay} withDivider={!!reference} />
        {reference ? <SummaryRow label="Reference" value={reference} /> : null}
      </View>

      <View className="gap-3">
        <Text className="text-[14px] leading-5 text-white/70">Pay with</Text>
        {options.length === 0 ? (
          <View className="rounded-twice bg-card p-5">
            {/*
              `estimated_amounts` is a quote for the requested tokens, not a
              balance filter — Wirex only rejects a short balance at execute,
              with ErrorInsufficientFunds. So an empty list means nothing was
              priced, which is not the same as "you cannot afford this".
            */}
            <Text className="text-[15px] text-white/70">
              No payment token is available for this transfer right now.
            </Text>
          </View>
        ) : (
          options.map(option => (
            <TokenOption
              key={option.tokenAddress}
              option={option}
              currency={estimate.currency}
              fiatAmount={estimate.amount}
              isSelected={option.tokenAddress === selectedTokenAddress}
              onPress={() => onSelectToken(option.tokenAddress)}
            />
          ))
        )}
      </View>

      {isExpiring ? (
        <Text className="text-center text-[13px] leading-4 text-amber-400">
          This quote is about to expire. Go back and try again to refresh it.
        </Text>
      ) : null}
    </ScrollView>
  );
};

/** Two decimals, thousands-separated — the way a bank quotes an amount. */
function formatAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const styles = StyleSheet.create({
  summaryRow: { paddingHorizontal: 21, paddingVertical: 16 },
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.1)', height: 1 },
  tokenOption: { paddingHorizontal: 21, paddingVertical: 16 },
});
