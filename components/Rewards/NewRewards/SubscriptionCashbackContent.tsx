import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { RewardsTier } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';

import {
  type CashbackCategoryKey,
  CATEGORY_CASHBACK_TABS,
  categoryCashbackPresentation,
} from './categoryCashback';
import CategoryCashbackBrandBadge from './CategoryCashbackBrandBadge';
import { CATEGORY_CASHBACK_BRANDS } from './categoryCashbackBrands';
import RewardsDiamondIcon from './RewardsDiamondIcon';

import type { SubscriptionCashbackData } from './SubscriptionCashbackSheet.types';

interface SubscriptionCashbackContentProps extends SubscriptionCashbackData {
  onGetMoreCashback: () => void;
  onDismiss: () => void;
  animationSession: number;
  /** Clear the drag handle when presented as a bottom sheet. */
  isSheet?: boolean;
  /** Native sheets lay their handle above the scroll body. */
  sheetTopPadding?: number;
}

const REWARDS_TERMS_URL =
  'https://support.solid.xyz/en/articles/15613716-solid-rewards-terms-and-conditions';

const CategoryCard = ({ category, rate }: { category: CashbackCategoryKey; rate: number }) => {
  const locked = rate <= 0;
  const label = locked
    ? category === 'airlines'
      ? 'Ultra'
      : 'Prime'
    : `${formatNumber(rate, 2, 0)}%`;

  return (
    <View className="w-full overflow-hidden rounded-twice bg-[#2B2B2B] pb-[9px]">
      <View className="h-[58px] flex-row items-center justify-between pl-[19px] pr-[18px]">
        <Text className="text-base font-medium text-white/70">Cashback rate</Text>
        <View
          className={cn(
            'h-9 min-w-[59px] flex-row items-center justify-center rounded-full',
            locked ? 'gap-[5px] bg-white/[0.06] px-[14px]' : 'bg-white/10 px-3',
          )}
        >
          {locked && (
            <Image
              source={require('@/assets/images/subscription-cashback/lock.svg')}
              style={{ width: 12, height: 12 }}
              contentFit="contain"
            />
          )}
          <Text
            className={cn(
              'font-medium',
              locked ? 'text-[15px] text-white/45' : 'text-base text-white',
            )}
          >
            {label}
          </Text>
        </View>
      </View>
      <View className="h-px bg-white/10" />
      <View className="pt-[10px]">
        {CATEGORY_CASHBACK_BRANDS[category].map(brand => (
          <View
            key={brand.name}
            className={cn('h-[55px] flex-row items-center pl-5 pr-[18px]', locked && 'opacity-50')}
          >
            <CategoryCashbackBrandBadge brand={brand} />
            <Text className="ml-2 flex-1 text-base font-medium text-white" numberOfLines={1}>
              {brand.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const SubscriptionCashbackContent = ({
  currentTier,
  subscriptionDiscountRate,
  subscriptionCategoryRates,
  onGetMoreCashback,
  onDismiss,
  animationSession,
  isSheet = true,
  sheetTopPadding = 60,
}: SubscriptionCashbackContentProps) => {
  const [selectedCategory, setSelectedCategory] = useState<CashbackCategoryKey>('ai');
  const presentation = categoryCashbackPresentation(
    currentTier,
    subscriptionDiscountRate,
    subscriptionCategoryRates,
  );

  return (
    <View
      className={cn('items-center pb-10', isSheet && 'px-[34px]')}
      style={isSheet ? { paddingTop: sheetTopPadding } : undefined}
    >
      <RewardsDiamondIcon key={animationSession} loop />
      <Text
        className="mt-[41px] w-[291px] max-w-full text-center text-[30px] text-white"
        style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 30 }}
      >
        Up to{' '}
        <Text
          className="text-[30px] text-[#94F27F]"
          style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 30 }}
        >
          {formatNumber(presentation.headlineRate, 2, 0)}%
        </Text>
        {'\n'}Cashback
      </Text>
      <Text
        className="mt-[15px] w-[284px] max-w-full text-center text-base text-white/70"
        style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 17.6 }}
      >
        {presentation.subtitle}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-7 h-9 w-full rounded-full bg-white/[0.08]"
        contentContainerStyle={{ padding: 4, flexGrow: 1, justifyContent: 'space-between' }}
        accessibilityRole="tablist"
      >
        {CATEGORY_CASHBACK_TABS.map(category => {
          const selected = selectedCategory === category.key;
          return (
            <Pressable
              key={category.key}
              accessibilityRole="tab"
              aria-selected={selected}
              accessibilityLabel={category.label}
              accessibilityState={{ selected }}
              onPress={() => setSelectedCategory(category.key)}
              className={cn(
                'h-7 items-center justify-center rounded-full px-3',
                selected && 'bg-white',
              )}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: selected ? '#0F0F11' : 'rgba(255,255,255,0.6)' }}
              >
                {category.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View className="mt-4 w-full">
        <CategoryCard category={selectedCategory} rate={presentation.rates[selectedCategory]} />
      </View>

      <Text
        className="ml-[3px] mt-7 w-full max-w-[323px] self-start text-base text-white/70"
        style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 16 }}
      >
        Cashback is credited 14 days after the transaction settles.{' '}
        <Text
          accessibilityRole="link"
          className="text-white/70"
          style={{
            fontFamily: 'MonaSans_700Bold',
            lineHeight: 16,
            textDecorationLine: 'underline',
          }}
          onPress={() => void Linking.openURL(REWARDS_TERMS_URL)}
        >
          Learn more
        </Text>
      </Text>
      <Button
        variant="brand"
        accessibilityRole="button"
        onPress={currentTier === RewardsTier.ULTRA ? onDismiss : onGetMoreCashback}
        className="mt-8 w-full transition-all active:scale-95 active:opacity-80"
        style={{ height: 48 }}
      >
        <Text className="text-black" style={{ fontFamily: 'MonaSans_700Bold' }}>
          {presentation.actionLabel}
        </Text>
      </Button>
    </View>
  );
};

export default SubscriptionCashbackContent;
