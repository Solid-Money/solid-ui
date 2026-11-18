import { View } from 'react-native';
import { Check } from 'lucide-react-native';

import ReferSheet from '@/components/Referral/v4/ReferSheet';
import {
  REFER_ACCENT,
  ReferAmountChip,
  ReferDivider,
} from '@/components/Referral/v4/ReferV4Primitives';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cardCreditSourceLine } from '@/lib/cardCredit';
import { formatUsdCents } from '@/lib/referral/referralV4';

import CardCreditIllustration from './CardCreditIllustration';

import type { CardCreditSummary } from '@/lib/types';

/** The rules from the Card bonus explainer in Figma 31316:16459. */
const RULES = [
  'Always used first, before your balance',
  'Can’t be withdrawn or sent',
  'No cashback on the part paid with the bonus',
  'Doesn’t expire',
];

interface CardCreditSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Wallet passes the personal bonus summary. Refer & Earn opens the explainer. */
  credit?: CardCreditSummary;
}

const CardCreditSheet = ({ isOpen, onOpenChange, credit }: CardCreditSheetProps) => {
  const source = cardCreditSourceLine(credit?.sources);
  const availableUsd = credit?.availableUsd ?? 0;
  const pendingUsd = credit?.pendingUsd ?? 0;
  // Held credit is not there to spend: a purchase holding all of it is no
  // reason for a $0.00 chip.
  const hasCredit = availableUsd > 0;
  const spendLine = credit?.spendable
    ? 'Spend it with your Solid card.'
    : 'Spend it once your Solid card is active.';

  return (
    <ReferSheet isOpen={isOpen} onOpenChange={onOpenChange} contentKey="card-credit">
      <CardCreditIllustration isOpen={isOpen} />
      <Text className="mt-[14px] text-center text-[22px] font-semibold text-white">Card bonus</Text>
      {hasCredit ? (
        <View className="mt-[10px]">
          <ReferAmountChip label={formatUsdCents(availableUsd)} />
        </View>
      ) : null}
      <Text className="mt-3 text-center text-[15px] leading-[21px] text-white/60">
        {hasCredit
          ? `${source ? `${source} ` : ''}${spendLine}`
          : 'Your referral bonuses are paid as card bonus, to spend with your Solid card.'}
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

      <Button variant="brand" className="mt-6 w-full" onPress={() => onOpenChange(false)}>
        <Text>Got it</Text>
      </Button>
    </ReferSheet>
  );
};

export default CardCreditSheet;
