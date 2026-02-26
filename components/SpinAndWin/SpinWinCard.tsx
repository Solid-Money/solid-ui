import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

interface SpinWinCardProps {
  currentStreak: number;
  spinAvailable: boolean;
  onPress: () => void;
}

export default function SpinWinCard({ currentStreak, spinAvailable, onPress }: SpinWinCardProps) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          backgroundColor: '#1A1A1A',
          borderRadius: 16,
          borderCurve: 'continuous',
          padding: 16,
          borderWidth: 1,
          borderColor: spinAvailable ? 'rgba(255, 209, 81, 0.4)' : 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-white">Spin & Win</Text>
            <Text className="mt-1 text-sm text-gray-400">
              {spinAvailable ? 'Your daily spin is ready!' : `${currentStreak}/7 day streak`}
            </Text>
          </View>

          <View className="flex-row gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i < currentStreak ? '#FFD151' : '#333333',
                }}
              />
            ))}
          </View>
        </View>

        {spinAvailable && (
          <View
            style={{
              marginTop: 12,
              backgroundColor: '#FFD151',
              borderRadius: 8,
              borderCurve: 'continuous',
              paddingVertical: 8,
              alignItems: 'center',
            }}
          >
            <Text className="text-sm font-bold text-black">Spin Now</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
