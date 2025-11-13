import { Text } from '@/components/ui/text';
import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

interface StepIndicatorProps {
  stepId: number;
  completed: boolean;
  onPress: () => void;
}

export function StepIndicator({ stepId, completed, onPress }: StepIndicatorProps) {
  return (
    <Pressable className="mt-1" onPress={onPress}>
      {completed ? (
        <View className="w-8 h-8 rounded-full bg-[#94F27F] items-center justify-center">
          <Check size={16} color="black" strokeWidth={3} />
        </View>
      ) : (
        <View className="w-8 h-8 rounded-full bg-[#4D4D4D] items-center justify-center">
          <Text className="text-white font-semibold text-sm">{stepId}</Text>
        </View>
      )}
    </Pressable>
  );
}
