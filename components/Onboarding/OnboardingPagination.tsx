import { View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface OnboardingPaginationProps {
  data: any[];
  currentIndex: number;
}

function Dot({ isActive }: { isActive: boolean }) {
  const animatedStyle = useAnimatedStyle(() => {
    const width = withSpring(isActive ? 16 : 8);
    return {
      width,
      backgroundColor: '#CACACA',
    };
  });

  return (
    <Animated.View
      style={[
        {
          height: 8,
          borderRadius: 4,
        },
        animatedStyle,
      ]}
    />
  );
}

export function OnboardingPagination({ data, currentIndex }: OnboardingPaginationProps) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      {data.map((_, index) => (
        <Dot key={index} isActive={index === currentIndex} />
      ))}
    </View>
  );
}
