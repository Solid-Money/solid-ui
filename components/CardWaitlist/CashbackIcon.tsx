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
      className="items-center justify-center rounded-full bg-[#94F27F26]"
    >
      <Text className="text-[22px] font-light text-brand">{displayPercentage}%</Text>
    </View>
  );
};
