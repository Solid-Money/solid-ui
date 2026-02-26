import { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { SPIN_WIN } from '@/constants/spinWinDesign';

interface CountdownRevealProps {
  onComplete: () => void;
}

function CountdownNumber({ number, onDone }: { number: number; onDone: () => void }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.2, { duration: 400, easing: Easing.out(Easing.back(1.5)) }),
      withTiming(0.8, { duration: 300 }),
      withTiming(0, { duration: 200 }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 200 }),
    );

    const timer = setTimeout(onDone, 900);
    return () => clearTimeout(timer);
  }, [scale, opacity, onDone]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
        },
        animatedStyle,
      ]}
    >
      <Text
        style={{
          fontSize: 150,
          fontWeight: '700',
          color: SPIN_WIN.colors.gold,
          textShadowColor: SPIN_WIN.colors.goldGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 30,
        }}
      >
        {number}
      </Text>
    </Animated.View>
  );
}

export default function CountdownReveal({ onComplete }: CountdownRevealProps) {
  const [currentNumber, setCurrentNumber] = useState(3);

  const handleDone = () => {
    if (currentNumber > 1) {
      setCurrentNumber(prev => prev - 1);
    } else {
      onComplete();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
      {/* Custom header: "Spin & Win" title, close X on right, no back button */}
      <Stack.Screen
        options={{
          title: 'Spin & Win',
          headerTitleStyle: {
            color: SPIN_WIN.colors.textPrimary,
            fontSize: 20,
            fontWeight: '600',
          },
          headerLeft: () => null,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.navigate(path.SPIN_WIN as never)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={22} color={SPIN_WIN.colors.textPrimary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* "And the winner is..." text */}
      <View style={{ alignItems: 'center', marginTop: 40 }}>
        <Text
          style={{
            fontSize: SPIN_WIN.typography.titleSize,
            fontWeight: SPIN_WIN.typography.titleWeight,
            color: SPIN_WIN.colors.textPrimary,
            textAlign: 'center',
            letterSpacing: -3,
            width: 230,
          }}
        >
          And the winner is...
        </Text>
      </View>

      {/* Countdown number with gold glow circle */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {/* Gold glow circle behind the number */}
        <View
          style={{
            position: 'absolute',
            width: SPIN_WIN.hero.imageSize,
            height: SPIN_WIN.hero.imageSize,
            borderRadius: SPIN_WIN.hero.imageSize / 2,
            backgroundColor: SPIN_WIN.colors.goldSubtle,
            shadowColor: SPIN_WIN.colors.gold,
            shadowRadius: 80,
            shadowOpacity: 0.4,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
        <CountdownNumber key={currentNumber} number={currentNumber} onDone={handleDone} />
      </View>
    </View>
  );
}
