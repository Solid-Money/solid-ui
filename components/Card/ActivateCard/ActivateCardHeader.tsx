import { View } from 'react-native';

import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';

interface ActivateCardHeaderProps {
  onBack: () => void;
}

export function ActivateCardHeader({ onBack }: ActivateCardHeaderProps) {
  return (
    <View className="flex-row items-center justify-between">
      <BackButton onPress={onBack} />
      <Text className="text-center text-xl font-semibold text-white md:text-2xl">Solid card</Text>
      <View className="w-10" />
    </View>
  );
}
