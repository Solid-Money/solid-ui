import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn, formatNumber } from '@/lib/utils';

import RewardsDiamondIcon from './RewardsDiamondIcon';
import SubscriptionBrandBadge from './SubscriptionBrandBadge';
import {
  SUBSCRIPTION_CATEGORIES,
  subscriptionCategoriesSentence,
  type SubscriptionCategory,
} from './subscriptionBrands';

import type { SubscriptionCashbackData } from './SubscriptionCashbackSheet.types';

interface SubscriptionCashbackContentProps extends SubscriptionCashbackData {
  onGetMoreCashback: () => void;
  animationSession: number;
  /**
   * Bottom-sheet presentation: adds the top padding that clears the sheet's drag
   * handle. False inside a modal, which brings its own padding.
   */
  isSheet?: boolean;
}

/** Logo badge diameter in the merchant rows. */
const BADGE_SIZE = 30;

const CategoryCard = ({ category, rate }: { category: SubscriptionCategory; rate: string }) => (
  <View className="w-full overflow-hidden rounded-twice bg-[#2B2B2B]">
    <View className="h-[58px] justify-center px-[19px]">
      <Text className="text-base font-medium text-white/70">{category.label}</Text>
    </View>
    <View className="h-px bg-white/10" />
    {category.brands.map(brand => (
      <View key={brand.name} className="h-[55px] flex-row items-center px-[20px]">
        <SubscriptionBrandBadge brand={brand} size={BADGE_SIZE} />
        <Text className="ml-2 flex-1 text-base font-medium text-white" numberOfLines={1}>
          {brand.name}
        </Text>
        <View className="h-9 min-w-[59px] items-center justify-center rounded-full bg-white/10 px-3">
          <Text className="text-base font-medium text-white">{rate}</Text>
        </View>
      </View>
    ))}
  </View>
);

/**
 * Subscription cashback details: every eligible service, grouped by category,
 * each showing the rate the user's tier earns back on it.
 */
const SubscriptionCashbackContent = ({
  subscriptionDiscountRate,
  onGetMoreCashback,
  animationSession,
  isSheet = true,
}: SubscriptionCashbackContentProps) => {
  const rate = `${formatNumber(subscriptionDiscountRate || 0, 2, 0)}%`;

  return (
    <View className={cn('items-center', isSheet && 'px-[34px] pt-[46px]')}>
      <RewardsDiamondIcon key={animationSession} />

      <Text
        className="mt-[31px] w-[291px] text-center text-[30px] text-white"
        style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 36 }}
      >
        <Text className="text-[30px] text-[#94F27F]" style={{ fontFamily: 'MonaSans_600SemiBold' }}>
          {rate}
        </Text>{' '}
        Subscription Cashback
      </Text>
      <Text
        className="mt-[7px] w-[284px] text-center text-base text-white/70"
        style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 18 }}
      >
        on {subscriptionCategoriesSentence()}
      </Text>

      <View className="mt-9 w-full gap-[15px]">
        {SUBSCRIPTION_CATEGORIES.map(category => (
          <CategoryCard key={category.key} category={category} rate={rate} />
        ))}
      </View>

      <Text
        className="mt-7 w-full text-base text-white/70"
        style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 18 }}
      >
        Cashback is credited 14 days after the transaction settles and paid straight into your
        Savings{' '}
        <Text className="font-bold text-white/70 underline" onPress={onGetMoreCashback}>
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
};

export default SubscriptionCashbackContent;
