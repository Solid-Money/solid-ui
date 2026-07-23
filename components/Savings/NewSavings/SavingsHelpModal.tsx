import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, {
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

import { SAVINGS_HELP_SLIDES } from './savingsHelpData';
import SavingsHelpGlow from './SavingsHelpGlow';

const SLIDE_TRANSITION_MS = 320;
const DOT_TRANSITION_MS = 250;

interface SavingsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SlideDot = ({ active }: { active: boolean }) => {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: DOT_TRANSITION_MS });
  }, [active, progress]);

  const style = useAnimatedStyle(() => ({
    width: 6 + progress.value * 14,
    opacity: 0.3 + progress.value * 0.7,
  }));

  return <Animated.View className="h-[6px] rounded-full bg-white" style={style} />;
};

/**
 * "How savings works" help carousel (Figma 20226-461 / 20232-461 / 20232-462).
 * Opened from the "?" button in the Savings screen's mobile header.
 *
 * Uses React Native's native `Modal` (its own OS-level window) rather than the
 * shared Dialog/ResponsiveModal, so it reliably covers the tab bar and the
 * Savings screen's glass navbar instead of sitting behind them.
 */
const SavingsHelpModal = ({ isOpen, onClose }: SavingsHelpModalProps) => {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const slide = SAVINGS_HELP_SLIDES[index];
  const isLastSlide = index === SAVINGS_HELP_SLIDES.length - 1;

  useEffect(() => {
    if (isOpen) setIndex(0);
  }, [isOpen]);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      onClose();
      return;
    }
    setIndex(current => current + 1);
  }, [isLastSlide, onClose]);

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <View className="px-[18px] pb-2 pt-2">
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/10 web:hover:bg-white/15"
          >
            <ArrowLeft color="#ffffff" size={22} />
          </Pressable>
        </View>

        <View className="flex-1 overflow-hidden">
          <Animated.View
            key={slide.key}
            entering={SlideInRight.duration(SLIDE_TRANSITION_MS)}
            exiting={SlideOutLeft.duration(SLIDE_TRANSITION_MS)}
            className="absolute inset-0"
          >
            <View style={{ width: '100%', aspectRatio: 1 }}>
              <View className="absolute inset-0 items-center justify-center">
                <View style={{ width: '115%', height: '115%' }}>
                  <SavingsHelpGlow color={slide.glowColor} />
                </View>
              </View>
              <Image
                source={getAsset(slide.hero)}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            </View>

            <Text
              className="mt-6 px-6 text-center text-[28px] font-semibold text-white"
              style={{ lineHeight: 34 }}
            >
              {slide.title}
            </Text>
            <Text
              className="mt-3 self-center px-6 text-center text-[16px] text-white/60"
              style={{ lineHeight: 24, maxWidth: 345 }}
            >
              {slide.description}
            </Text>
          </Animated.View>
        </View>

        <View className="flex-row items-center justify-center gap-[6px] pb-6">
          {SAVINGS_HELP_SLIDES.map((s, i) => (
            <SlideDot key={s.key} active={i === index} />
          ))}
        </View>

        <View className="px-5" style={{ paddingBottom: insets.bottom + 16 }}>
          <Pressable
            onPress={handleNext}
            className="h-[58px] w-full items-center justify-center rounded-full bg-white active:scale-95 active:opacity-90"
          >
            <Text className="text-[18px] font-medium text-[#111]">{slide.cta}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export default SavingsHelpModal;
