import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { times } from '@/constants/coins';
import { useCoinStore } from '@/store/useCoinStore';
import { cn } from '@/lib/utils';

const CoinChartTime = () => {
  const { selectedTime, setSelectedTime } = useCoinStore();

  return (
    <View className="flex-row justify-between items-center gap-2 bg-card rounded-twice px-6 py-2 w-full max-w-xs mx-auto">
      {times.map(time => (
        <Pressable
          key={time.value}
          onPress={() => setSelectedTime(time.value)}
          className="hover:opacity-70"
        >
          <Text className={cn(selectedTime !== time.value && 'text-muted-foreground')}>
            {time.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

export default CoinChartTime;
