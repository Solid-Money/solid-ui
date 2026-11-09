import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';

import ReferSheet from '@/components/Referral/v4/ReferSheet';
import {
  REFER_ACCENT,
  ReferAmountChip,
  ReferDivider,
  RewardIcon,
} from '@/components/Referral/v4/ReferV4Primitives';
import { Text } from '@/components/ui/text';
import { cardCreditSourceLine } from '@/lib/cardCredit';
import { formatUsdCents } from '@/lib/referral/referralV4';

import type { CardCreditSummary } from '@/lib/types';

/** The rules, as Figma 29602:13791 words them. */
const RULES = [
  'Always used first, before your balance',
  'Can’t be withdrawn or sent',
  'No cashback on the part paid with credit',
  'Doesn’t expire',
];

interface CardCreditSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent while it loads, or when it could not be read. */
  credit?: CardCreditSummary;
}

/**
 * What card credit is (Figma 29602:13791): how much is left, where it came
 * from, and the four rules that make it different from the balance. Opened
 * from the Home pill, which only shows while there is credit, and from the
 * referral program's "How you earn" sheet, where the user may have none to
 * spend: then it explains that bonuses are paid this way rather than showing
 * $0. That is also what it says while the credit is unknown, which is true
 * whatever the balance turns out to be.
 */
const CardCreditSheet = ({ isOpen, onOpenChange, credit }: CardCreditSheetProps) => {
  const source = cardCreditSourceLine(credit?.sources);
  const availableUsd = credit?.availableUsd ?? 0;
  const pendingUsd = credit?.pendingUsd ?? 0;
  // Held credit is not there to spend: a purchase holding all of it is no
  // reason for a $0.00 chip.
  const hasCredit = availableUsd > 0;
  // Credit can be earned before there is a card to spend it with: a referrer
  // without an active card still sees what they hold, and what it takes.
  const spendLine = credit?.spendable
    ? 'Spend it with your Solid card.'
    : 'Spend it once your Solid card is active.';

  return (
    <ReferSheet isOpen={isOpen} onOpenChange={onOpenChange} contentKey="card-credit">
      <RewardIcon kind="welcome" size={56} />
      <Text className="mt-[14px] text-center text-[22px] font-semibold text-white">
        Card credit
      </Text>
      {hasCredit ? (
        <View className="mt-[10px]">
          <ReferAmountChip label={formatUsdCents(availableUsd)} />
        </View>
      ) : null}
      <Text className="mt-3 text-center text-[15px] leading-[21px] text-white/60">
        {hasCredit
          ? `${source ? `${source} ` : ''}${spendLine}`
          : 'Your referral bonuses are paid as card credit, to spend with your Solid card.'}
      </Text>
      {pendingUsd > 0 ? (
        <Text className="mt-1 text-center text-[13px] text-white/40">
          {formatUsdCents(pendingUsd)} held for a pending purchase
        </Text>
      ) : null}

      <View className="mt-[22px] w-full rounded-[20px] bg-white/[0.05] px-4 py-1">
        {RULES.map((rule, index) => (
          <View key={rule}>
            {index > 0 ? <ReferDivider /> : null}
            <View className="flex-row items-center gap-3 py-[13px]">
              <Check size={16} color={REFER_ACCENT} strokeWidth={2.2} />
              <Text className="flex-1 text-[14px] text-white/85">{rule}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => onOpenChange(false)}
        accessibilityRole="button"
        className="mt-6 h-[56px] w-full items-center justify-center rounded-[16px] bg-brand active:opacity-80 web:hover:opacity-90"
      >
        <Text className="text-[16px] font-semibold text-black">Got it</Text>
      </Pressable>
    </ReferSheet>
  );
};

export default CardCreditSheet;
