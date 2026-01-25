import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

interface RewardBenefitProps {
  icon?: string;
  title: string;
  description?: string;
  iconSize?: number;
}

const RewardBenefit = ({ icon, title, description, iconSize = 50 }: RewardBenefitProps) => {
  return (
    <View className="flex-row items-center gap-2">
      {icon && (
        <Image
          source={getAsset(icon as keyof typeof getAsset)}
          contentFit="contain"
          style={{ width: iconSize, height: iconSize }}
        />
      )}
      <View>
        <Text className="text-lg font-semibold leading-5">{title}</Text>
        {description && <Text className="text-base opacity-70">{description}</Text>}
      </View>
    </View>
  );
};

export default RewardBenefit;
