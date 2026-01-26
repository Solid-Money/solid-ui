import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';

interface TierBenefitsCardProps {
  label: string;
  icon: string;
  onPress: () => void;
}

const TierBenefitsCard = ({ label, icon, onPress }: TierBenefitsCardProps) => {
  const { isScreenMedium } = useDimension();
  return (
    <Pressable
      className="flex-1 rounded-twice bg-card p-5 hover:opacity-90 md:px-8 md:py-6"
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold md:text-xl">{label}</Text>
        <View className="flex-row items-center gap-4">
          <Image
            source={icon}
            contentFit="contain"
            style={{ width: isScreenMedium ? 34 : 24, height: isScreenMedium ? 34 : 24 }}
          />
          <ChevronRight size={isScreenMedium ? 30 : 24} strokeWidth={1} color="#FFD151" />
        </View>
      </View>
    </Pressable>
  );
};

export default TierBenefitsCard;
