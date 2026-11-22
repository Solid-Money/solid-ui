import { type ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { EUR_VAULT } from '@/constants/vaults';
import { formatCashbackFigures } from '@/lib/formatMonthlyCashback';
import { CashbackCurrency } from '@/lib/types';
import { cn, formatNumber, formatWholeDollars } from '@/lib/utils';
import { formatCurrencyAmount } from '@/lib/vaultCurrency';

import RewardsDiamondIcon from './RewardsDiamondIcon';

import type { CashbackDetailsData } from './CashbackDetailsSheet.types';

interface CashbackDetailsContentProps extends CashbackDetailsData {
  onGetMoreCashback: () => void;
  animationSession: number;
  /**
   * Bottom-sheet presentation: adds the top padding that clears the sheet's drag
   * handle. False inside a modal, which brings its own padding.
   */
  isSheet?: boolean;
}

/** One "label — value" row of the stats block. */
const StatRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <View className="min-h-[58px] flex-row items-center justify-between px-[19px] py-3">
    <Text className="text-base font-medium text-white/70">{label}</Text>
    {children}
  </View>
);

const Divider = () => <View className="h-px bg-white/10" />;

/** Caps and totals in whole units: "$450", or "€450" for a euro cardholder. */
const formatWhole = (value: number, currency: CashbackCurrency): string =>
  currency === 'EUR' ? formatCurrencyAmount(value || 0, 'EUR', 0, 0) : formatWholeDollars(value);

/**
 * Lifetime cashback in each currency, side by side and never added together
 * ("€12.40 + $150.00"). In cents, the same figure as the rewards card that
 * opens this sheet: it includes escrow, so a new cardholder's first purchase
 * reads here as it does on the card rather than rounding to $0.
 */
const LifetimeCashbackValue = ({
  lifetimeCashback,
}: Pick<CashbackDetailsData, 'lifetimeCashback'>) => (
  <Text className="max-w-[55%] text-right text-lg font-medium text-white">
    {formatCashbackFigures(lifetimeCashback)}
  </Text>
);

const CashbackDetailsContent = ({
  cashbackRate,
  currency = 'USD',
  monthlyCashbackLabel,
  maxCashbackMonthly,
  tierMonthlyCap,
  lifetimeCashback,
  lifetimeCashbackIsPartial,
  onGetMoreCashback,
  animationSession,
  isSheet = true,
}: CashbackDetailsContentProps) => (
  <View className={cn('items-center', isSheet && 'px-[34px] pt-[46px]')}>
    <RewardsDiamondIcon key={animationSession} />

    <Text
      className="mt-[31px] text-center text-[30px] text-white"
      style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 36 }}
    >
      Cashback
    </Text>
    <Text
      className="mt-[7px] w-[284px] text-center text-base text-white/70"
      style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 18 }}
    >
      {currency === 'EUR'
        ? 'Earn euros back on eligible card spend, up to your monthly limit'
        : 'Earn USDC back on eligible card spend, up to your monthly limit'}
    </Text>

    <View className="mt-9 w-full overflow-hidden rounded-twice bg-[#2B2B2B]">
      <StatRow label="Your cashback rate">
        <Text className="text-lg font-bold text-[#94F27F]">
          {formatNumber(cashbackRate || 0, 0, 2)}%
        </Text>
      </StatRow>
      <Divider />
      <View className="gap-0.5 px-[19px] py-3">
        <View className="flex-row items-center gap-x-2">
          <Text className="flex-1 text-base font-medium text-white/70">
            Cashback earned this month
          </Text>
          <Text className="max-w-[55%] text-right text-lg font-medium text-[#94F27F]">
            {monthlyCashbackLabel}
          </Text>
        </View>
        <Text className="text-xs text-white/50">Total includes pending cashback.</Text>
      </View>
      <Divider />
      {/* The month's cap sits above the tier's only when purchases were made
          under a bigger one — a trial that has since ended — and those keep
          it. Saying so is what stops "$100" next to a Core rate reading as a
          mistake, and new purchases count toward the tier's own cap. */}
      {tierMonthlyCap !== undefined && maxCashbackMonthly > tierMonthlyCap ? (
        <View className="gap-0.5 px-[19px] py-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-medium text-white/70">Monthly cap</Text>
            <Text className="text-lg font-medium text-white">
              {formatWhole(maxCashbackMonthly, currency)}
            </Text>
          </View>
          <Text className="text-xs text-white/50">
            Purchases made on a higher tier earlier this month keep its cap. New purchases count
            toward your current {formatWhole(tierMonthlyCap, currency)} cap.
          </Text>
        </View>
      ) : (
        <StatRow label="Monthly cap">
          <Text className="text-lg font-medium text-white">
            {formatWhole(maxCashbackMonthly, currency)}
          </Text>
        </StatRow>
      )}
      <Divider />
      {lifetimeCashbackIsPartial ? (
        // The app's own lower bound, not the backend's complete total (an
        // older backend, or one that couldn't read it): said so, rather than
        // passed off as the whole lifetime.
        <View className="gap-0.5 px-[19px] py-3">
          <View className="flex-row items-center gap-x-2">
            <Text className="flex-1 text-base font-medium text-white/70">Lifetime cashback</Text>
            <LifetimeCashbackValue lifetimeCashback={lifetimeCashback} />
          </View>
          <Text className="text-xs text-white/50">Some recent cashback may not show here yet.</Text>
        </View>
      ) : (
        <StatRow label="Lifetime cashback">
          <LifetimeCashbackValue lifetimeCashback={lifetimeCashback} />
        </StatRow>
      )}
    </View>

    <Text
      className="mt-7 w-full text-base text-white/70"
      style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 18 }}
    >
      Cashback is credited 14 days after the transaction settles and paid straight into your{' '}
      {currency === 'EUR' ? EUR_VAULT.vaultName : 'Savings'}{' '}
      <Text
        className="text-white/70"
        style={{
          fontFamily: 'SolidLink_700Bold',
          lineHeight: 18,
          textDecorationLine: 'underline',
        }}
        onPress={onGetMoreCashback}
      >
        Learn more
      </Text>
    </Text>

    <Button
      variant="brand"
      accessibilityRole="button"
      onPress={onGetMoreCashback}
      className="mt-[35px] w-full transition-all active:scale-95 active:opacity-80"
    >
      <Text className="text-black">Get more cashback</Text>
    </Button>
  </View>
);

export default CashbackDetailsContent;
