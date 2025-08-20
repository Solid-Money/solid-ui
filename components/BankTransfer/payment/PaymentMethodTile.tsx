import { Text } from '@/components/ui/text';
import { ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function PaymentMethodTile({ title, onPress, loading, disabled }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
      className="bg-[#1C1C1C] rounded-2xl px-6 py-4"
    >
      <View className="flex-row items-center py-3 pl-2">
        <View className="flex-1">
          <Text className="text-white text-lg font-bold">{title}</Text>
        </View>
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <ChevronRight color="#fff" width={20} height={20} />
        )}
      </View>
    </TouchableOpacity>
  );
}
