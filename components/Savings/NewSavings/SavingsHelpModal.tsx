import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, X } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import VideoIllustration from '@/components/ui/video-illustration';
import { useDimension } from '@/hooks/useDimension';

import { SAVINGS_HELP_SLIDES, SavingsHelpSlide } from './savingsHelpData';

const MODAL_BACKGROUND = '#0f0f10';
const DOT_TRANSITION_MS = 250;
const DESKTOP_MODAL_WIDTH = 512;
const DESKTOP_MODAL_HEIGHT = 720;
const TITLE_SLOT_HEIGHT = 40;
const BODY_SLOT_HEIGHT = 72;
const COPY_BOTTOM_PADDING = 32;

const SLIDE_ANIMATIONS: Record<string, number> = {
  deposit: require('@/assets/animations/savings-help-deposit.mp4'),
  grow: require('@/assets/animations/savings-help-grow.mp4'),
  withdraw: require('@/assets/animations/savings-help-withdraw.mp4'),
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

  return (
    <Animated.View style={[{ height: 6, borderRadius: 999, backgroundColor: '#ffffff' }, style]} />
  );
};

const HelpPage = ({
  slide,
  isActive,
  playbackSession,
  pageWidth,
}: {
  slide: SavingsHelpSlide;
  isActive: boolean;
  playbackSession: number;
  pageWidth: number;
}) => {
  return (
    <View style={{ width: pageWidth, height: '100%' }}>
      <View className="flex-1 items-center justify-center">
        <VideoIllustration
          source={SLIDE_ANIMATIONS[slide.key]}
          isActive={isActive}
          restartKey={playbackSession}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
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
 * Each illustration is an exact, single-play export of its Figma timeline,
 * encoded as H.264 so it is hardware decoded rather than decoded frame by
 * frame on the main thread. Only the visible page plays; selecting it restarts
 * its animation.
 *
 * Uses React Native's native `Modal` (its own OS-level window) rather than the
 * shared Dialog/ResponsiveModal, so it reliably covers the tab bar and the
 * Savings screen's glass navbar instead of sitting behind them.
 */
const SavingsHelpModal = ({ isOpen, onClose }: SavingsHelpModalProps) => {
  const insets = useSafeAreaInsets();
  const { isScreenMedium } = useDimension();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktopPopup = Platform.OS === 'web' && isScreenMedium;
  const pageWidth = isDesktopPopup ? Math.min(DESKTOP_MODAL_WIDTH, windowWidth - 32) : windowWidth;
  const modalHeight = Math.min(DESKTOP_MODAL_HEIGHT, windowHeight - 32);
  const pagerRef = useRef<ScrollView>(null);
  const navigationTargetRef = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const [playbackSession, setPlaybackSession] = useState(0);
  const slide = SAVINGS_HELP_SLIDES[index];
  const isLastSlide = index === SAVINGS_HELP_SLIDES.length - 1;

  // Reset the pager and restart the first illustration each time the modal
  // opens so its single-play animation starts from the beginning.
  useEffect(() => {
    navigationTargetRef.current = null;
    if (!isOpen) return;

    setIndex(0);
    setPlaybackSession(session => session + 1);
    const frame = requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: 0, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const goToSlide = useCallback(
    (targetIndex: number) => {
      navigationTargetRef.current = targetIndex;
      setIndex(targetIndex);
      pagerRef.current?.scrollTo({
        x: targetIndex * pageWidth,
        animated: true,
      });
    },
    [pageWidth],
  );

  const handleNext = useCallback(() => {
    if (navigationTargetRef.current !== null) return;

    if (isLastSlide) {
      onClose();
      return;
    }
    goToSlide(index + 1);
  }, [goToSlide, index, isLastSlide, onClose]);

  // Activate the nearest page while it moves into view. On web, momentum-end
  // is not guaranteed to fire after a manual swipe, which can leave the old
  // page active and the visible illustration paused on its first frame.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const navigationTarget = navigationTargetRef.current;

      // Animated scrollTo emits events from the outgoing page first. Keep the
      // requested page active until the pager reaches its destination.
      if (navigationTarget !== null) {
        if (Math.abs(offsetX - navigationTarget * pageWidth) < 1) {
          navigationTargetRef.current = null;
        }
        setIndex(currentIndex =>
          currentIndex === navigationTarget ? currentIndex : navigationTarget,
        );
        return;
      }

      const targetIndex = Math.round(offsetX / pageWidth);
      const boundedIndex = Math.max(0, Math.min(targetIndex, SAVINGS_HELP_SLIDES.length - 1));
      setIndex(currentIndex => (currentIndex === boundedIndex ? currentIndex : boundedIndex));
    },
    [pageWidth],
  );

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent={isDesktopPopup}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        className={`flex-1 ${isDesktopPopup ? 'items-center justify-center p-4' : ''}`}
        style={{
          backgroundColor: isDesktopPopup ? 'rgba(0, 0, 0, 0.8)' : MODAL_BACKGROUND,
        }}
      >
        <View
          className={isDesktopPopup ? 'overflow-hidden rounded-[32px]' : 'flex-1'}
          style={{
            width: isDesktopPopup ? pageWidth : '100%',
            height: isDesktopPopup ? modalHeight : '100%',
            paddingTop: isDesktopPopup ? 0 : insets.top,
            backgroundColor: MODAL_BACKGROUND,
          }}
        >
          <View
            className={`flex-row items-center p-4 ${isDesktopPopup ? 'justify-end' : 'justify-between'}`}
          >
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={onClose}
              className="-my-[3px] h-[50px] w-[50px] items-center justify-center rounded-full bg-[#2A2A2A] transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover"
            >
              {isDesktopPopup ? (
                <X color="#ffffff" size={22} />
              ) : (
                <ArrowLeft color="#ffffff" size={22} />
              )}
            </Pressable>
          </View>

          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            snapToInterval={pageWidth}
            bounces={false}
            overScrollMode="never"
            directionalLockEnabled
            disableIntervalMomentum
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
            className="flex-1"
            contentContainerStyle={{ alignItems: 'stretch', height: '100%' }}
          >
            {SAVINGS_HELP_SLIDES.map((item, itemIndex) => (
              <HelpPage
                key={item.key}
                slide={item}
                isActive={itemIndex === index}
                playbackSession={playbackSession}
                pageWidth={pageWidth}
              />
            ))}
          </ScrollView>

          <View
            className="flex-row items-center justify-center gap-[6px]"
            style={{ height: 30, flexShrink: 0, transform: [{ translateY: -35 }] }}
          >
            {SAVINGS_HELP_SLIDES.map((item, itemIndex) => (
              <SlideDot key={item.key} active={itemIndex === index} />
            ))}
          </View>

          <View
            className="px-4"
            style={{ paddingBottom: (isDesktopPopup ? 0 : insets.bottom) + 16 }}
          >
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
      </View>
    </Modal>
  );
};

export default SavingsHelpModal;
