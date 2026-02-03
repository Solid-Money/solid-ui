import { ReactNode } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

interface RewardBenefitProps {
  icon?: string;
  iconText?: string;
  title: string;
  description: string;
  descriptionNode?: ReactNode;
  iconSize?: number;
}

const RewardBenefit = ({
  icon,
  iconText,
  title,
  description,
  descriptionNode,
  iconSize = 50,
}: RewardBenefitProps) => {
  return (
    <View className="flex-row items-center gap-2">
      {iconText ? (
        <View
          className="items-center justify-center rounded-full bg-rewards/20"
          style={{ width: iconSize, height: iconSize }}
        >
          <Text className="text-xl text-rewards">{iconText}</Text>
        </View>
      ) : icon ? (
        <Image
          source={getAsset(icon as keyof typeof getAsset)}
          contentFit="contain"
          style={{ width: iconSize, height: iconSize }}
        />
      ) : null}
      <View className="min-w-0 flex-1">
        <Text className="text-lg font-semibold leading-5">{title}</Text>
        <View className="mt-0.5">
          {descriptionNode ?? <Text className="text-base opacity-70">{description}</Text>}
        </View>
      </View>
    </View>
  );
};

export default RewardBenefit;
