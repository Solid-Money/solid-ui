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
        <View className="h-8 w-8 items-center justify-center rounded-full bg-[#94F27F]">
          <Check size={16} color="black" strokeWidth={3} />
        </View>
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-[#4D4D4D]">
          <Text className="text-sm font-semibold text-white">{stepId}</Text>
        </View>
      )}
    </Pressable>
  );
}
