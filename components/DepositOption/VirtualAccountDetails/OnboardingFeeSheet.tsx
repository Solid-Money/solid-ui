import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useOnboardingFeePayment } from '@/hooks/useOnboardingFee';
import { track } from '@/lib/analytics';
import { OnboardingFeeProduct } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

const SHEET_BACKGROUND = '#1A1A1A';
const SUMMARY_BACKGROUND = '#252525';
const DIVIDER = 'rgba(255,255,255,0.08)';
const HANDLE = 'rgba(255,255,255,0.3)';
const CTA_HEIGHT = 50;
// The sheet's own bottom padding in Figma, before the device's home indicator.
const SHEET_PADDING_BOTTOM = 34;

/**
 * A dollar amount in prose — the headline, the badge, the button.
 *
 * Trailing zeros dropped, because "$10" is how the fee is spoken about and
 * "A one-time $10.00 fee" reads like a receipt. A fee of $12.50 still prints
 * its cents.
 */
const usd = (amount: number) => `$${formatNumber(amount, 2, 0)}`;

/** The same amount in the fee table, where every row lines up at two places. */
const usdExact = (amount: number) => `$${formatNumber(amount, 2, 2)}`;

const SummaryRow = ({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) => (
  <View className="w-full flex-row items-start justify-between">
    <Text className="text-[15px] leading-[21px] text-white/70">{label}</Text>
    <View className="items-end">
      <Text className="text-right text-[15px] font-medium leading-[21px] text-white">{value}</Text>
      {caption ? (
        <Text className="mt-0.5 text-right text-[13px] leading-[18px] text-white/50">
          {caption}
        </Text>
      ) : null}
    </View>
  </View>
);

export interface OnboardingFeeSheetProps {
  product: OnboardingFeeProduct;
  /** Dismiss without paying — "Not now", the scrim, or the hardware back. */
  onDismiss: () => void;
  /** The fee is settled; carry on with whatever it was gating. */
  onPaid: () => void;
}

/**
 * The one-time setup fee, as a sheet over the pitch it gates.
 *
 * Deliberately not its own modal: the pitch stays mounted and visible behind
 * the scrim, which is both what the design shows and what makes "Not now" a
 * step back rather than a dead end — the user lands on the pitch they were
 * reading, not on an empty deposit screen.
 *
 * Renders nothing at all when there is nothing to pay. The fee is configured
 * per country and ships switched off, so "$0" is a normal answer and must not
 * put a payment step in front of someone with nothing to pay — `onPaid` fires
 * instead, and the flow continues as if the sheet had never opened.
 */
export const OnboardingFeeSheet = ({ product, onDismiss, onPaid }: OnboardingFeeSheetProps) => {
  const insets = useSafeAreaInsets();
  const {
    feeUsd,
    satisfied,
    payment,
    availableUsd,
    insufficientFunds,
    isLoading,
    phase,
    error,
    pay,
  } = useOnboardingFeePayment(product);

  const isBusy = phase === 'paying' || phase === 'confirming';

  useEffect(() => {
    if (isLoading) return;
    track(TRACKING_EVENTS.ONBOARDING_FEE_SHEET_VIEWED, {
      product,
      fee_usd: feeUsd ?? 0,
      already_satisfied: satisfied,
    });
  }, [feeUsd, isLoading, product, satisfied]);

  // Nothing owed — the line is off, this country is exempt, or they have
  // already paid. Carry on rather than showing a sheet asking for $0.
  useEffect(() => {
    if (!isLoading && satisfied) onPaid();
  }, [isLoading, onPaid, satisfied]);

  const handlePay = async () => {
    track(TRACKING_EVENTS.ONBOARDING_FEE_PAY_PRESSED, {
      product,
      fee_usd: feeUsd ?? 0,
      pay_with: payment?.asset.symbol,
    });

    const paid = await pay();

    if (paid) {
      track(TRACKING_EVENTS.ONBOARDING_FEE_PAID, {
        product,
        fee_usd: feeUsd ?? 0,
        pay_with: payment?.asset.symbol,
      });
      onPaid();
    }
  };

  if (isLoading || satisfied) return null;

  const amount = feeUsd ?? 0;

  return (
    <View style={StyleSheet.absoluteFill} className="justify-end">
      <Pressable
        accessibilityLabel="Dismiss"
        style={StyleSheet.absoluteFill}
        className="bg-black/65"
        onPress={isBusy ? undefined : onDismiss}
      />

      <View
        style={[styles.sheet, { paddingBottom: SHEET_PADDING_BOTTOM + insets.bottom }]}
        className="w-full items-center gap-[14px] overflow-hidden px-4 pt-[14px]"
      >
        <View style={styles.handle} />
        <View style={styles.spacerLarge} />

        <View style={styles.badge} className="items-center justify-center bg-brand/15">
          <Text className="text-[20px] font-semibold text-brand">{usd(amount)}</Text>
        </View>

        <Text className="text-center text-[22px] font-semibold text-white">
          A one-time {usd(amount)} fee
        </Text>

        <Text className="w-full text-center text-[16px] leading-[22px] text-white/70">
          Opening your US bank account costs {usd(amount)}. You pay it once, before you verify your
          identity.
        </Text>

        <View style={styles.summary} className="w-full gap-[14px] overflow-hidden bg-[#252525] p-4">
          <SummaryRow label="Account setup fee" value={usdExact(amount)} />
          <SummaryRow label="Billed" value="Once" />
          <View style={styles.divider} />
          <SummaryRow
            label="Pay from"
            value="Solid balance"
            caption={`${usdExact(availableUsd)} available`}
          />
        </View>

        {error ? (
          <Text className="w-full text-center text-[13px] leading-[18px] text-red-400">
            {error}
          </Text>
        ) : (
          <Text className="w-full text-center text-[13px] leading-[18px] text-white/50">
            {insufficientFunds
              ? `Add at least ${usd(amount)} to your Solid balance to continue.`
              : 'Next, you’ll verify your identity to open the account.'}
          </Text>
        )}

        <View style={styles.spacerSmall} />

        <Button
          variant="brand"
          className="w-full rounded-full border-0 active:opacity-90"
          style={{ height: CTA_HEIGHT }}
          onPress={handlePay}
          disabled={isBusy || insufficientFunds}
        >
          {isBusy ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="text-[16px] font-semibold text-black">
              Pay {usd(amount)} and continue
            </Text>
          )}
        </Button>

        <Pressable disabled={isBusy} onPress={onDismiss}>
          <Text className="text-[16px] font-medium text-white">Not now</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: SHEET_BACKGROUND,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  handle: { width: 73, height: 5, borderRadius: 3, backgroundColor: HANDLE },
  spacerLarge: { height: 8 },
  spacerSmall: { height: 2 },
  badge: { width: 64, height: 64, borderRadius: 100 },
  summary: { backgroundColor: SUMMARY_BACKGROUND, borderRadius: 16 },
  divider: { width: '100%', height: 1, backgroundColor: DIVIDER },
});

export default OnboardingFeeSheet;
