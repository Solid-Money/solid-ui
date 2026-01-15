import { Pressable, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Text } from '@/components/ui/text';
import { times } from '@/constants/coins';
import { cn } from '@/lib/utils';
import { useCoinStore } from '@/store/useCoinStore';

const CoinChartTime = () => {
  const { selectedTime, setSelectedTime } = useCoinStore(
    useShallow(state => ({
      selectedTime: state.selectedTime,
      setSelectedTime: state.setSelectedTime,
    })),
  );

  return (
    <View className="mx-auto w-full max-w-xs flex-row items-center justify-between gap-2 rounded-twice bg-card px-6 py-2">
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
