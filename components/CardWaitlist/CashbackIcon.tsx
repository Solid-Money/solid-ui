import { View } from 'react-native';

import { Text } from '@/components/ui/text';

interface CashbackIconProps {
  percentage: number;
}

export const CashbackIcon = ({ percentage }: CashbackIconProps) => {
  const displayPercentage = Math.round(percentage * 100);

  return (
    <View
      style={{ width: 50, height: 50 }}
      className="items-center justify-center bg-[#94F27F26] rounded-full"
    >
      <Text className="text-brand font-light text-[22px]">{displayPercentage}%</Text>
    </View>
  );
};
