import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { formatRate, formatUsdWhole } from '@/lib/referral/referralV4';

import ReferSheet from './ReferSheet';
import { REFER_ACCENT, ReferDivider, ReferTermsLink } from './ReferV4Primitives';

import type { ReferralV4Summary } from '@/lib/types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The rules, each worded from the live terms so a changed setting changes the copy. */
export const howItWorksRules = (summary: ReferralV4Summary): string[] => {
  const { terms, bonusLimit } = summary;
  const payoutDay = WEEKDAYS[terms.spendShare.payoutWeekday] ?? 'Thursday';
  const rules = [
    `Every bonus unlocks ${terms.holdDays} days after it's earned, then arrives in the next ${payoutDay} payout.`,
    `Spend share is ${formatRate(
      terms.spendShare.rate,
    )} of what your friend spends with their card each week, paid every ${payoutDay} in soFUSE.`,
    `You can earn up to ${formatUsdWhole(
      terms.spendShare.capPerFriendUsd,
    )} from each friend. Bonuses and spend share both count toward it; boosts don't.`,
  ];

  if (terms.bonusLimit.enabled) {
    rules.push(
      `Your first ${terms.bonusLimit.base} welcome bonuses are paid right away. Every friend who spends ${formatUsdWhole(
        terms.bonusLimit.activeSpendUsd,
      )} or more in their second month unlocks ${terms.bonusLimit.perActiveFriend} more. Bonuses past the limit are kept and paid when it grows.${
        bonusLimit
          ? ` You've used ${bonusLimit.used} of ${bonusLimit.limit}${
              bonusLimit.waiting > 0 ? `, ${bonusLimit.waiting} waiting` : ''
            }.`
          : ''
      }`,
    );
  }

  rules.push(
    'Bonuses are paid as card credit: used first when you pay with your Solid card, never withdrawn or sent, no cashback on the part it pays, and it doesn’t expire.',
    'A friend counts once they sign up with your link, verify their identity and activate their card. Cash withdrawals, transfers, gift cards, gambling and very small purchases don’t count toward spend.',
  );

  if (terms.excludedCountries.length > 0) {
    rules.push(
      `Friends with an ID from ${terms.excludedCountries.join(
        ', ',
      )} earn you spend share and upgrade bonuses, but not welcome or big spender bonuses.`,
    );
  }

  return rules;
};

interface ReferHowItWorksSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ReferralV4Summary;
}

/** "How you earn · Details": the program's rules in one place. */
const ReferHowItWorksSheet = ({ isOpen, onOpenChange, summary }: ReferHowItWorksSheetProps) => {
  const rules = howItWorksRules(summary);

  return (
    <ReferSheet isOpen={isOpen} onOpenChange={onOpenChange} contentKey="referral-v4-details">
      <Text className="mt-1 text-center text-[22px] font-semibold text-white">How it works</Text>
      <View className="mt-5 w-full rounded-[20px] bg-white/[0.05] px-4 py-1">
        {rules.map((rule, index) => (
          <View key={index}>
            {index > 0 ? <ReferDivider /> : null}
            <View className="flex-row items-start gap-3 py-3">
              <View className="pt-[2px]">
                <Check size={16} color={REFER_ACCENT} strokeWidth={2.2} />
              </View>
              <Text className="flex-1 text-[14px] leading-[20px] text-white/85">{rule}</Text>
            </View>
          </View>
        ))}
      </View>
      <View className="mt-4">
        <ReferTermsLink />
      </View>
      <Pressable
        onPress={() => onOpenChange(false)}
        accessibilityRole="button"
        className="mt-5 h-[56px] w-full items-center justify-center rounded-[16px] bg-brand active:opacity-80 web:hover:opacity-90"
      >
        <Text className="text-[16px] font-semibold text-black">Got it</Text>
      </Pressable>
    </ReferSheet>
  );
};

export default ReferHowItWorksSheet;
