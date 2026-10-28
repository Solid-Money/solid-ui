import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { CashbackDiamondIcon } from '@/components/Card/NewCardDetails/icons';
import { Text } from '@/components/ui/text';
import { formatUsdCents } from '@/lib/referral/referralV4';
import { cn } from '@/lib/utils';

import type { CardTransactionCardCredit } from '@/lib/types';

// Exact pixel sizes, as on the cashback card beside it (Figma 29602:14154): the
// Tailwind scale is remapped on native and the design asks for the same sizes
// on every platform.
const ROW = 'min-h-[64px] justify-center border-t border-white/10 pl-[24px] pr-[20px]';
const LABEL = 'text-[16px] font-medium text-[#ACACAC]';
const VALUE = 'text-[16px] font-bold text-white';
const NOTE = 'text-[13px] leading-[18px] text-white/50';

/** The card's faint top-left glow: #94F27F at 10% fading out. */
const GLOW_RADIUS = 230;

const CardCreditGlow = () => (
  <View pointerEvents="none" className="absolute left-0 top-0">
    <Svg width={GLOW_RADIUS} height={GLOW_RADIUS}>
      <Defs>
        <RadialGradient
          id="card-credit-card-glow"
          cx="0"
          cy="0"
          r={GLOW_RADIUS}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#94F27F" stopOpacity={0.1} />
          <Stop offset="1" stopColor="#94F27F" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={GLOW_RADIUS} height={GLOW_RADIUS} fill="url(#card-credit-card-glow)" />
    </Svg>
  </View>
);

const DetailRow = ({ label, value, note }: { label: string; value: ReactNode; note?: string }) => (
  <View className={cn(ROW, note && 'gap-[6px] pb-[18px] pt-[20px]')}>
    <View className="flex-row items-center justify-between gap-3">
      <Text className={LABEL}>{label}</Text>
      {value}
    </View>
    {note ? <Text className={NOTE}>{note}</Text> : null}
  </View>
);

/**
 * What card credit paid for this purchase (Figma 29602:14154): the credit
 * used, the rest from the balance, the credit left after it and where that
 * credit came from — and the one rule that changes the receipt, that the credit
 * part earns no cashback.
 */
const CardCreditDetailsCard = memo(function CardCreditDetailsCard({
  credit,
}: {
  credit: CardTransactionCardCredit;
}) {
  const isHeld = credit.state === 'held';
  const isReleased = credit.state === 'released';

  return (
    <View className="overflow-hidden rounded-[20px] bg-card">
      <CardCreditGlow />

      <View className="min-h-[64px] justify-center pl-[24px] pr-[20px]">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[6px]">
            <CashbackDiamondIcon size={14} />
            <Text className="text-[16px] font-medium text-brand">
              {isHeld ? 'Card credit (held)' : 'Card credit'}
            </Text>
          </View>
          <Text className="text-[16px] font-bold text-brand">
            {isReleased ? formatUsdCents(credit.used_usd) : `-${formatUsdCents(credit.used_usd)}`}
          </Text>
        </View>
      </View>

      <DetailRow
        label="From your balance"
        value={<Text className={VALUE}>{formatUsdCents(credit.from_balance_usd)}</Text>}
      />
      <DetailRow
        label="Card credit left"
        value={<Text className={VALUE}>{formatUsdCents(credit.remaining_usd)}</Text>}
      />
      {credit.refunded_usd ? (
        <DetailRow
          label="Returned as credit"
          value={
            <Text className={cn(VALUE, 'text-brand')}>+{formatUsdCents(credit.refunded_usd)}</Text>
          }
        />
      ) : null}
      {credit.source_label ? (
        <DetailRow
          label="From"
          value={
            <Text className={cn(VALUE, 'shrink text-right')} numberOfLines={1}>
              {credit.source_label}
            </Text>
          }
          note="Used first on every card purchase until it runs out."
        />
      ) : null}

      <View className="border-t border-white/10 pb-[18px] pl-[24px] pr-[20px] pt-[16px]">
        <Text className="text-[14px] leading-[20px] text-white/80">
          No cashback on the part paid with card credit. Anything above your credit earns cashback
          as usual.
        </Text>
      </View>
    </View>
  );
});

export default CardCreditDetailsCard;
