import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ChevronDown } from 'lucide-react-native';
import { View } from 'react-native';

type CurrencyPillProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export default function CurrencyPill({ label, onPress, disabled }: CurrencyPillProps) {
  return (
    <Button
      className="h-12 rounded-full bg-[#404040] px-4 text-white"
      onPress={onPress}
      disabled={disabled}
    >
      <View className="flex-row items-center gap-2">
        {/* Placeholder for flag/coin icon if needed later */}
        <Text className="text-base font-bold text-white">{label}</Text>
        <ChevronDown className="text-white" />
      </View>
    </Button>
  );
}
