import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';

import RewardComingSoon from '@/components/Rewards/RewardComingSoon';
import { Text } from '@/components/ui/text';
import { getTierDisplayName, getTierIcon } from '@/constants/rewards';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';
import { RewardsTier, TierBenefit, TierBenefits } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface RewardTableRow {
  label: string;
  subtitle?: string;
  values: (TierBenefit | null)[];
  isComingSoon?: boolean;
  isSubtitleHidden?: boolean;
}

interface RewardTableProps {
  title: string;
  headerLabel?: string;
  rows: RewardTableRow[];
  tierBenefits: TierBenefits[];
  valueTextClassName?: string;
}

const RewardTable = ({
  title,
  headerLabel,
  rows,
  tierBenefits,
  valueTextClassName = 'text-base font-semibold',
}: RewardTableProps) => {
  const { isScreenMedium } = useDimension();
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const sortedTiers = tierBenefits.sort((a, b) => {
    const order = [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA];
    return order.indexOf(a.tier) - order.indexOf(b.tier);
  });

  const rowMinHeight = 80;
  const labelColumnWidth = isScreenMedium
    ? containerWidth > 0
      ? containerWidth * 0.25
      : 200
    : 150;
  const dataColumnWidth = isScreenMedium ? (containerWidth > 0 ? containerWidth * 0.25 : 200) : 150;

  return (
    <View className="gap-6 rounded-twice bg-card p-6 md:gap-10 md:p-10">
      <Text className="text-2xl font-semibold text-rewards">{title}</Text>
      <View
        className="overflow-hidden rounded-lg"
        onLayout={e => {
          const width = e.nativeEvent.layout.width;
          if (width > 0 && containerWidth !== width) {
            setContainerWidth(width);
          }
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header row */}
            <View style={{ minHeight: rowMinHeight }} className="flex-row">
              <View
                style={{ width: labelColumnWidth }}
                className="justify-center bg-card/50 p-4 pl-0"
              >
                {headerLabel && <Text className="font-semibold">{headerLabel}</Text>}
              </View>
              {sortedTiers.map((tier, tierIndex) => (
                <View
                  key={tier.tier}
                  style={{ width: dataColumnWidth }}
                  className={cn('p-4', tierIndex === sortedTiers.length - 1 && 'pr-0')}
                >
                  <View className="gap-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-2xl font-semibold text-rewards">
                        {getTierDisplayName(tier.tier)}
                      </Text>
                      <Image
                        source={getTierIcon(tier.tier)}
                        contentFit="contain"
                        style={{ width: 18, height: 18 }}
                      />
                    </View>
                    <Text className="font-medium leading-5 opacity-70 md:text-base">
                      {tier.tier === RewardsTier.CORE
                        ? 'All members'
                        : tier.tier === RewardsTier.PRIME
                          ? 'Tier unlocked at\n5M Points'
                          : 'Tier unlocked at\n35M Points'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Body rows */}
            {rows.map((row, rowIndex) => (
              <View key={rowIndex} style={{ minHeight: rowMinHeight }} className="flex-row">
                <View style={{ width: labelColumnWidth }} className="p-4 pl-0">
                  <Text className="text-base font-semibold leading-5">{row.label}</Text>
                  {row.subtitle && !row.isSubtitleHidden && (
                    <Text className="text-xs opacity-70">{row.subtitle}</Text>
                  )}
                  {row.isComingSoon && <RewardComingSoon />}
                </View>
                {row.values.map((value, colIndex) => (
                  <View
                    key={colIndex}
                    style={{ width: dataColumnWidth }}
                    className={cn('p-4', colIndex === row.values.length - 1 && 'pr-0')}
                  >
                    {value ? (
                      <View className="gap-1">
                        {value.image && (
                          <Image
                            source={getAsset(value.image as keyof typeof getAsset)}
                            contentFit="contain"
                            style={{ width: 80, height: 30 }}
                          />
                        )}
                        <Text className={valueTextClassName}>{value.title}</Text>
                        {value.subtitle && (
                          <Text className="text-sm font-medium leading-4 opacity-70">
                            {value.subtitle}
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default RewardTable;
