import { Text } from '@/components/ui/text';
import { ChevronRight } from 'lucide-react-native';
import { TouchableOpacity, View } from 'react-native';

type Props = {
  title: string;
  onPress?: () => void;
};

export function PaymentMethodTile({ title, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-[#1C1C1C] rounded-2xl px-6 py-4"
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full bg-[#3E3E3E] mr-4" />
        <View className="flex-1">
          <Text className="text-white text-lg font-bold">{title}</Text>
        </View>
        <ChevronRight color="#fff" width={20} height={20} />
      </View>
    </TouchableOpacity>
  );
}
