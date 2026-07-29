import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { type AssetPath, getAsset } from '@/lib/assets';

import { SAVINGS_HELP_SLIDES, SavingsHelpSlide } from './savingsHelpData';

const MODAL_BACKGROUND = '#0f0f10';
const DOT_TRANSITION_MS = 250;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TITLE_SLOT_HEIGHT = 40;
const BODY_SLOT_HEIGHT = 72;
const COPY_BOTTOM_PADDING = 32;

const SLIDE_ANIMATIONS: Record<string, AssetPath> = {
  deposit: 'animations/savings-help-deposit.webp',
  grow: 'animations/savings-help-grow.webp',
  withdraw: 'animations/savings-help-withdraw.webp',
};

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

const HelpPage = ({
  slide,
  isActive,
  playbackSession,
}: {
  slide: SavingsHelpSlide;
  isActive: boolean;
  playbackSession: number;
}) => {
  return (
    <View style={{ width: SCREEN_WIDTH, height: '100%' }}>
      <View className="flex-1 items-center justify-center">
        <Image
          key={`${slide.key}-${isActive ? `active-${playbackSession}` : 'inactive'}`}
          source={getAsset(SLIDE_ANIMATIONS[slide.key])}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          autoplay={isActive}
        />
      </View>

      <View className="items-center px-6" style={{ paddingBottom: COPY_BOTTOM_PADDING }}>
        <View className="w-full items-center justify-center" style={{ height: TITLE_SLOT_HEIGHT }}>
          <Text
            className="text-center text-[28px] font-semibold text-white"
            style={{ lineHeight: 34 }}
          >
            {slide.title}
          </Text>
        </View>

        <View
          className="mt-3 w-full items-center justify-start"
          style={{ height: BODY_SLOT_HEIGHT }}
        >
          <Text
            className="text-center text-[16px] text-white/60"
            style={{ lineHeight: 21, maxWidth: 345 }}
          >
            {slide.description}
          </Text>
        </View>
      </View>
    </View>
  );
};

/**
 * "How savings works" help carousel (Figma 20609-4854 / 20609-4946 / 20609-4989).
 * Opened from the "?" button in the Savings screen's mobile header.
 *
 * All three slides are mounted side by side in a real pager row — swiping (or
 * tapping the CTA) drags/slides between actual pages rather than faking it
 * with a fade/slide of a single swapped-out content block.
 *
 * Each illustration is an exact, single-play animated WebP export of its Figma
 * timeline. Only the visible page plays; selecting it restarts its animation.
 *
 * Uses React Native's native `Modal` (its own OS-level window) rather than the
 * shared Dialog/ResponsiveModal, so it reliably covers the tab bar and the
 * Savings screen's glass navbar instead of sitting behind them.
 */
const SavingsHelpModal = ({ isOpen, onClose }: SavingsHelpModalProps) => {
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [playbackSession, setPlaybackSession] = useState(0);
  const slide = SAVINGS_HELP_SLIDES[index];
  const isLastSlide = index === SAVINGS_HELP_SLIDES.length - 1;

  // Reset the pager and remount the first WebP each time the modal opens so
  // its single-play animation starts from the beginning.
  useEffect(() => {
    if (!isOpen) return;

    setIndex(0);
    setPlaybackSession(session => session + 1);
    const frame = requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: 0, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const goToSlide = useCallback((targetIndex: number) => {
    setIndex(targetIndex);
    pagerRef.current?.scrollTo({
      x: targetIndex * SCREEN_WIDTH,
      animated: true,
    });
  }, []);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      onClose();
      return;
    }
    goToSlide(index + 1);
  }, [goToSlide, index, isLastSlide, onClose]);

  const handleSwipeEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const targetIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    const boundedIndex = Math.max(0, Math.min(targetIndex, SAVINGS_HELP_SLIDES.length - 1));
    setIndex(boundedIndex);
  }, []);

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        className="flex-1"
        style={{ paddingTop: insets.top, backgroundColor: MODAL_BACKGROUND }}
      >
        <View className="flex-row items-center justify-between p-4">
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={onClose}
            className="-my-[3px] h-[50px] w-[50px] items-center justify-center rounded-full bg-[#2A2A2A] transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover"
          >
            <ArrowLeft color="#ffffff" size={22} />
          </Pressable>
        </View>

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          snapToInterval={SCREEN_WIDTH}
          bounces={false}
          overScrollMode="never"
          directionalLockEnabled
          disableIntervalMomentum
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleSwipeEnd}
          className="flex-1"
          contentContainerStyle={{ alignItems: 'flex-start' }}
        >
          {SAVINGS_HELP_SLIDES.map((item, itemIndex) => (
            <HelpPage
              key={item.key}
              slide={item}
              isActive={itemIndex === index}
              playbackSession={playbackSession}
            />
          ))}
        </ScrollView>

        <View className="flex-row items-center justify-center gap-[6px] pb-6">
          {SAVINGS_HELP_SLIDES.map((item, itemIndex) => (
            <SlideDot key={item.key} active={itemIndex === index} />
          ))}
        </View>

        <View className="px-4" style={{ paddingBottom: insets.bottom + 16 }}>
          <Button
            variant="brand"
            size="lg"
            onPress={handleNext}
            className="h-14 w-full rounded-full bg-brand"
          >
            <Text className="text-base font-semibold text-black">{slide.cta}</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export default SavingsHelpModal;
