import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatRate, formatUsdWhole } from '@/lib/referral/referralV4';

import { eachLabel } from './ReferRewardSheet';
import ReferSheet from './ReferSheet';
import { ReferIcon, type ReferRewardKind, ReferTermsLink, RewardIcon } from './ReferV4Primitives';

import type { ReferralV4Terms } from '@/lib/types';

export interface RewardRowCopy {
  kind: ReferRewardKind;
  title: string;
  subtitle: string;
  value: string;
}

/** The four rewards, one line each, worded from the live terms. */
export const allRewardsRows = (terms: ReferralV4Terms): RewardRowCopy[] => [
  {
    kind: 'spendShare',
    title: 'Spend share',
    subtitle: 'of everything they spend',
    value: formatRate(terms.spendShare.rate),
  },
  {
    kind: 'welcome',
    title: 'Welcome bonus',
    subtitle: `after ${formatUsdWhole(terms.welcome.spendTargetUsd)} in ${terms.welcome.windowDays} days`,
    value: eachLabel(terms.welcome.referrerUsd, terms.welcome.friendUsd),
  },
  {
    kind: 'bigSpender',
    title: 'Big spender bonus',
    subtitle: `after ${formatUsdWhole(terms.bigSpender.spendTargetUsd)} in ${terms.bigSpender.windowDays} days`,
    value: eachLabel(terms.bigSpender.referrerUsd, terms.bigSpender.friendUsd),
  },
  {
    kind: 'upgrade',
    title: 'Upgrade bonus',
    subtitle: 'for Prime or Ultra',
    value: `Up to ${formatUsdWhole(Math.max(terms.upgrade.primeUsd, terms.upgrade.ultraUsd))}`,
  },
];

interface RowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value?: string;
  onPress: () => void;
}

/** One line of the list (Figma "Row / …"): tapping opens that reward's own sheet. */
const Row = ({ icon, title, subtitle, value, onPress }: RowProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={value ? `${title}, ${value}, ${subtitle}` : `${title}, ${subtitle}`}
    className="w-full flex-row items-center gap-3 py-[14px] active:opacity-70 web:hover:opacity-80"
  >
    {icon}
    <View className="min-w-0 flex-1 gap-0.5">
      <Text className="text-[15px] font-medium leading-5 text-white">{title}</Text>
      <Text className="text-[13px] leading-[18px] text-white/50">{subtitle}</Text>
    </View>
    {value ? <Text className="text-[15px] font-semibold leading-5 text-white">{value}</Text> : null}
    <ReferIcon asset="images/referral-v4/chevron-16.svg" size={16} />
  </Pressable>
);

/** The hairline under a row, starting where its text does (icon 40 + gap 12). */
const RowDivider = () => <View className="ml-[52px] h-px self-stretch bg-white/[0.06]" />;

interface ReferAllRewardsSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  terms: ReferralV4Terms;
  /** Opens one reward's sheet; this one closes first. */
  onOpenReward: (kind: ReferRewardKind) => void;
  /** Opens the card credit sheet; this one closes first. */
  onOpenCardCredit: () => void;
}

/**
 * Every way to earn on one sheet (Figma 30443:14782), opened from "View all":
 * a line per reward with what it pays, and how bonuses are paid out. Each row
 * hands over to its own sheet; the full rules live in the help centre article
 * behind "Read the full terms".
 */
const ReferAllRewardsSheet = ({
  isOpen,
  onOpenChange,
  terms,
  onOpenReward,
  onOpenCardCredit,
}: ReferAllRewardsSheetProps) => (
  <ReferSheet
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    contentKey="referral-v4-all-rewards"
    title="How you earn"
  >
    <View className="mt-2 w-full">
      {allRewardsRows(terms).map(row => (
        <View key={row.kind}>
          <Row
            icon={<RewardIcon kind={row.kind} size={40} />}
            title={row.title}
            subtitle={row.subtitle}
            value={row.value}
            onPress={() => onOpenReward(row.kind)}
          />
          <RowDivider />
        </View>
      ))}
      <Row
        icon={<ReferIcon asset="images/referral-v4/card-40.svg" size={40} />}
        title="Card credit"
        subtitle="How your bonuses are paid"
        onPress={onOpenCardCredit}
      />
    </View>
    <View className="mt-5">
      <ReferTermsLink />
    </View>
  </ReferSheet>
);

export default ReferAllRewardsSheet;
