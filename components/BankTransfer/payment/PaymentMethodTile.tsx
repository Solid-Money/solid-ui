import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';

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
      className="rounded-2xl bg-[#1C1C1C] px-6 py-4"
    >
      <View className="flex-row items-center py-3 pl-2">
        <View className="flex-1">
          <Text className="text-lg font-bold text-white">{title}</Text>
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
