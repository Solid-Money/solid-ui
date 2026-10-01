import { memo, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { format, formatDistanceStrict, isSameYear } from 'date-fns';

import {
  buildCashbackBreakdown,
  type CashbackFooter,
  type CashbackTiming,
} from '@/components/Activity/cashbackBreakdown';
import { CashbackDiamondIcon } from '@/components/Card/NewCardDetails/icons';
import SubscriptionCashbackSheet from '@/components/Rewards/NewRewards/SubscriptionCashbackSheet';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useRewardsUserData, useTierBenefits } from '@/hooks/useRewards';
import { cn } from '@/lib/utils';

import type { Cashback, CashbackInfo } from '@/lib/types';

// Exact pixel sizes throughout (Figma 27704:3904): the Tailwind scale is
// remapped on native, and the design asks for the same sizes on every platform.
const ROW = 'min-h-[64px] justify-center border-t border-white/10 pl-[24px] pr-[20px]';
const LABEL = 'text-[16px] font-medium text-[#ACACAC]';
const VALUE = 'text-[16px] font-bold text-white';
const NOTE = 'text-[13px] leading-[18px] text-white/50';

/** The card's faint top-left glow: #94F27F at 16% fading out. */
const GLOW_RADIUS = 230;

const CashbackGlow = () => (
  <View pointerEvents="none" className="absolute left-0 top-0">
    <Svg width={GLOW_RADIUS} height={GLOW_RADIUS}>
      <Defs>
        <RadialGradient
          id="cashback-card-glow"
          cx="0"
          cy="0"
          r={GLOW_RADIUS}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#94F27F" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#94F27F" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={GLOW_RADIUS} height={GLOW_RADIUS} fill="url(#cashback-card-glow)" />
    </Svg>
  </View>
);

const SparkleIcon = () => (
  <Svg width={12} height={12} viewBox="0 0 12 12">
    <Path
      d="M6 0L7.6122 4.3878L12 6L7.6122 7.6122L6 12L4.3878 7.6122L0 6L4.3878 4.3878L6 0Z"
      fill="#94F27F"
    />
  </Svg>
);

const ChevronIcon = ({ up }: { up: boolean }) => (
  <Svg
    width={12}
    height={7}
    viewBox="0 0 12 7"
    fill="none"
    style={up ? undefined : { transform: [{ rotate: '180deg' }] }}
  >
    <Path
      d="M0.75 5.75L5.75 0.75L10.75 5.75"
      stroke="#FFFFFF"
      strokeOpacity={0.6}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const formatDay = (value: string) => {
  const date = new Date(value);
  return format(date, isSameYear(date, new Date()) ? 'MMM d' : 'MMM d, yyyy');
};

/** "12 days", ticking over each minute; "Releasing soon" once the date has passed. */
const ReleaseCountdown = ({ payoutAt }: { payoutAt: string }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const target = new Date(payoutAt).getTime();

  return (
    <Text className={VALUE}>
      {target - now <= 0 ? 'Releasing soon' : formatDistanceStrict(target, now)}
    </Text>
  );
};

const DetailRow = ({ label, value, note }: { label: string; value: ReactNode; note?: string }) => (
  <View className={cn(ROW, note && 'gap-[6px] pb-[18px] pt-[20px]')}>
    <View className="flex-row items-center justify-between">
      <Text className={LABEL}>{label}</Text>
      {value}
    </View>
    {note ? <Text className={NOTE}>{note}</Text> : null}
  </View>
);

const TimingRow = ({ timing }: { timing: CashbackTiming }) => {
  if (timing.kind === 'paid') {
    return (
      <DetailRow
        label="Paid out"
        value={<Text className={VALUE}>{formatDay(timing.paidAt)}</Text>}
      />
    );
  }

  const day = formatDay(timing.payoutAt);
  return (
    <DetailRow
      label="Releases in"
      value={<ReleaseCountdown payoutAt={timing.payoutAt} />}
      note={
        timing.holdDays
          ? `Held for ${timing.holdDays} days, then paid out on ${day}.`
          : `Paid out on ${day}.`
      }
    />
  );
};

const FooterCopy = ({ footer }: { footer: CashbackFooter }) => (
  <Text className="text-[14px] leading-[20px] text-white/80">
    {footer.segments.map((segment, index) => (
      <Text key={index} className={segment.highlight ? 'font-semibold text-brand' : undefined}>
        {segment.text}
      </Text>
    ))}
    <Text
      className="font-semibold text-white/95"
      style={{ textDecorationLine: 'underline', textDecorationColor: 'rgba(255, 255, 255, 0.95)' }}
    >
      {footer.linkLabel}
    </Text>
  </Text>
);

type CashbackDetailsCardProps = {
  info: CashbackInfo;
  /** The raw row, for the stored rate and escrow dates. */
  cashback?: Cashback;
  /** What the purchase cost in USD, for the upsell line. */
  purchaseUsd: number | null;
  /**
   * The charge is authorized but not posted. The amount at the top of the
   * screen is the authorization then, and the cashback is not netted off it.
   */
  isPendingCharge?: boolean;
};

/**
 * The cashback on a card transaction, collapsed to the figure and what paid it
 * (Figma 27704:3788), expanding to the tier behind it, when it pays, and one
 * line on what more the user could earn (Figma 27704:3904).
 */
const CashbackDetailsCard = memo(function CashbackDetailsCard({
  info,
  cashback,
  purchaseUsd,
  isPendingCharge,
}: CashbackDetailsCardProps) {
  const { data: rewardsData } = useRewardsUserData();
  const { data: tierBenefits } = useTierBenefits();
  const [isExpanded, setIsExpanded] = useState(false);

  const breakdown = useMemo(
    () => buildCashbackBreakdown({ info, cashback, purchaseUsd, rewardsData, tierBenefits }),
    [info, cashback, purchaseUsd, rewardsData, tierBenefits],
  );

  const toggle = useCallback(() => setIsExpanded(expanded => !expanded), []);
  const openBenefits = useCallback(() => router.push(path.REWARDS_BENEFITS), []);

  const { isIneligible, footer, timing, tierLabel, rateLabel } = breakdown;
  const hasDetails = !isIneligible && !!(tierLabel || timing || footer);
  const amountTone = isIneligible ? 'text-white/50' : 'text-brand';

  const footerTrigger = footer ? (
    <Pressable
      accessibilityRole="link"
      onPress={footer.kind === 'upsell' ? openBenefits : undefined}
      className="border-t border-white/10 pb-[18px] pl-[24px] pr-[20px] pt-[16px] active:opacity-70 web:hover:opacity-80"
    >
      <FooterCopy footer={footer} />
    </Pressable>
  ) : null;

  return (
    <View className="overflow-hidden rounded-[20px] bg-card">
      {!isIneligible && <CashbackGlow />}

      <View
        className={cn(
          'justify-center pl-[24px] pr-[20px]',
          isIneligible || isPendingCharge ? 'gap-[6px] pb-[18px] pt-[20px]' : 'min-h-[64px]',
        )}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[6px]">
            <CashbackDiamondIcon size={14} />
            <Text className={cn('text-[16px] font-medium', amountTone)}>Cashback</Text>
          </View>
          <Text className={cn('text-[16px] font-bold', amountTone)}>{breakdown.amountLabel}</Text>
        </View>
        {isIneligible ? (
          <Text className={NOTE}>
            Cash withdrawals, money transfers and government payments don&apos;t earn cashback
          </Text>
        ) : isPendingCharge ? (
          <Text className={NOTE}>
            Cashback amount is not reflected on a pending transaction sum
          </Text>
        ) : null}
      </View>

      {!isIneligible && (
        <DetailRow
          label="Type"
          value={
            <View className="shrink flex-row items-center gap-[8px]">
              {breakdown.isSubscription && <SparkleIcon />}
              <Text className={cn(VALUE, 'shrink')} numberOfLines={1}>
                {breakdown.typeLabel}
              </Text>
              {rateLabel ? (
                <View
                  className={cn(
                    'rounded-full px-[9px] py-[3px]',
                    breakdown.isSubscription ? 'bg-brand' : 'bg-[rgba(148,242,127,0.15)]',
                  )}
                >
                  <Text
                    className={cn(
                      'text-[14px]',
                      breakdown.isSubscription
                        ? 'font-bold text-[#0B0B0B]'
                        : 'font-semibold text-brand',
                    )}
                  >
                    {rateLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          }
        />
      )}

      {hasDetails && isExpanded && (
        <>
          {tierLabel ? (
            <DetailRow label="Tier" value={<Text className={VALUE}>{tierLabel}</Text>} />
          ) : null}
          {timing ? <TimingRow timing={timing} /> : null}
          {footer && footerTrigger ? (
            footer.kind === 'categories' && rewardsData ? (
              <SubscriptionCashbackSheet
                trigger={footerTrigger}
                triggerContainerClassName=""
                currentTier={rewardsData.currentTier}
                subscriptionDiscountRate={rewardsData.subscriptionDiscountRate ?? 0}
                onGetMoreCashback={openBenefits}
              />
            ) : (
              footerTrigger
            )
          ) : null}
        </>
      )}

      {hasDetails && (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          className="h-[48px] flex-row items-center justify-center gap-[8px] border-t border-white/10 active:opacity-70 web:hover:opacity-80"
        >
          <Text className="text-[14px] font-medium text-white/60">
            {isExpanded ? 'Hide details' : 'Show details'}
          </Text>
          <ChevronIcon up={isExpanded} />
        </Pressable>
      )}
    </View>
  );
});

export default CashbackDetailsCard;
