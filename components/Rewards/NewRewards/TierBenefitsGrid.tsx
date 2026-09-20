import { type ReactElement } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { useIsSidebarShell } from '@/components/Navbar/Sidebar';
import { Text } from '@/components/ui/text';
import { cn, formatNumber } from '@/lib/utils';

import CashbackDetailsSheet from './CashbackDetailsSheet';
import { subscriptionCategoriesSentence } from './subscriptionBrands';
import SubscriptionCashbackSheet from './SubscriptionCashbackSheet';
import { chunkIntoRows, resolveTierBenefitKeys, type TierBenefitKey } from './tierBenefitCards';
import { CashbackIcon, ReferralsIcon, SubscriptionIcon, YieldBoostIcon } from './tierBenefitIcons';
import YieldBoostSheet from './YieldBoostSheet';

import type { CashbackDetailsData } from './CashbackDetailsSheet.types';
import type { YieldBoostData } from './YieldBoostSheet.types';

interface BenefitCardProps {
  title: string;
  description: string;
  icon: ReactElement;
  onPress?: () => void;
}

/**
 * One tier benefit: icon, what the benefit is, and what it applies to. Cards
 * that open a details sheet get their `onPress` from the sheet wrapper.
 */
const BenefitCard = ({ title, description, icon, onPress }: BenefitCardProps) => {
  const isSidebarShell = useIsSidebarShell();
  const useDesktopSpacing = Platform.OS === 'web' && isSidebarShell;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}. ${description}`}
      disabled={!onPress}
      onPress={onPress}
      className={cn(
        'min-h-[137px] w-full rounded-twice bg-card transition-all active:scale-95 active:opacity-80',
        useDesktopSpacing ? 'p-6' : 'px-[15px] pb-[19px] pt-[19px]',
      )}
    >
      {icon}
      {/* Titles are one line at the design's width; `min-h` rather than a fixed
          height lets the longer ones wrap on narrow phones instead of truncating. */}
      <Text className="mt-3 text-base font-medium leading-4 text-white" numberOfLines={2}>
        {title}
      </Text>
      <Text className="mt-1.5 text-sm leading-4 text-white/70" numberOfLines={2}>
        {description}
      </Text>
    </Pressable>
  );
};

interface TierBenefitsGridProps extends CashbackDetailsData, YieldBoostData {
  /** Cashback % the tier earns back on subscriptions; 0 hides that card. */
  subscriptionDiscountRate: number;
  onGetMoreCashback: () => void;
  onReferralsPress: () => void;
}

/**
 * "Your tier benefits" — the perks the user's CURRENT tier actually grants.
 *
 * Cashback and referrals come with every tier. The yield boost and subscription
 * cashback cards only appear once a tier unlocks them, so a Core user isn't
 * shown perks they can't use; they see them on the tier comparison screen
 * instead, where the point is what's still to come.
 *
 * Cards are laid out two per row, so an odd number leaves the last card at half
 * width rather than stretching it across the row.
 */
const TierBenefitsGrid = ({
  subscriptionDiscountRate,
  yieldBoostPercentage,
  yieldBoostCap,
  yieldBoostEarned,
  onGetMoreCashback,
  onReferralsPress,
  ...cashbackData
}: TierBenefitsGridProps) => {
  const subscriptionRate = `${formatNumber(subscriptionDiscountRate || 0, 2, 0)}%`;

  const cardsByKey: Record<TierBenefitKey, ReactElement> = {
    cashback: (
      <CashbackDetailsSheet
        key="cashback"
        trigger={
          <BenefitCard
            title={`${formatNumber(cashbackData.cashbackRate || 0, 2, 0)}% Cashback`}
            description="On every purchase"
            icon={<CashbackIcon />}
          />
        }
        {...cashbackData}
        onGetMoreCashback={onGetMoreCashback}
      />
    ),
    referrals: (
      <View key="referrals" className="flex-1">
        <BenefitCard
          title="Referrals"
          description="Invite friends & Earn"
          icon={<ReferralsIcon />}
          onPress={onReferralsPress}
        />
      </View>
    ),
    'yield-boost': (
      <YieldBoostSheet
        key="yield-boost"
        trigger={
          <BenefitCard
            title={`+${formatNumber(yieldBoostPercentage || 0, 2, 0)}% Yield Boost`}
            description="On your savings"
            icon={<YieldBoostIcon />}
          />
        }
        yieldBoostPercentage={yieldBoostPercentage}
        yieldBoostCap={yieldBoostCap}
        yieldBoostEarned={yieldBoostEarned}
      />
    ),
    subscription: (
      <SubscriptionCashbackSheet
        key="subscription"
        trigger={
          <BenefitCard
            title={`${subscriptionRate} Cashback`}
            description={`On ${subscriptionCategoriesSentence()}`}
            icon={<SubscriptionIcon rate={subscriptionRate} />}
          />
        }
        subscriptionDiscountRate={subscriptionDiscountRate}
        onGetMoreCashback={onGetMoreCashback}
      />
    ),
  };

  const rows = chunkIntoRows(
    resolveTierBenefitKeys({ yieldBoostPercentage, subscriptionDiscountRate }).map(
      key => cardsByKey[key],
    ),
  );

  return (
    <View className="gap-[15px] px-4">
      <Text className="text-base text-white/50">Your tier benefits</Text>
      {rows.map((row, index) => (
        <View key={index} className="flex-row gap-[15px]">
          {row}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
};

export default TierBenefitsGrid;
