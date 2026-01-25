import { Pressable, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { Text } from '@/components/ui/text';

interface ActivateCardHeaderProps {
  onBack: () => void;
}

export function ActivateCardHeader({ onBack }: ActivateCardHeaderProps) {
  return (
    <View className="flex-row items-center justify-between">
      <Pressable onPress={onBack} className="web:hover:opacity-70">
        <ArrowLeft color="white" />
      </Pressable>
      <Text className="text-center text-xl font-semibold text-white md:text-2xl">Solid card</Text>
      <View className="w-10" />
    </View>
  );
}
