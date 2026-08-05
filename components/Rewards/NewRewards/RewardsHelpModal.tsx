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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ArrowLeft } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import VideoIllustration from '@/components/ui/video-illustration';

import { REWARDS_HELP_SLIDES, type RewardsHelpSlide } from './rewardsHelpData';
import TierPointsSheet from './TierPointsSheet';

const MODAL_BACKGROUND = '#0f0f10';
const DOT_TRANSITION_MS = 250;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TITLE_SLOT_HEIGHT = 40;
const BODY_SLOT_HEIGHT = 72;
const COPY_BOTTOM_PADDING = 32;

const SLIDE_ANIMATIONS: Record<string, number> = {
  rewards: require('@/assets/animations/rewards-help-rewards.mp4'),
  tiers: require('@/assets/animations/rewards-help-tiers.mp4'),
  perks: require('@/assets/animations/rewards-help-perks.mp4'),
};

interface RewardsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called only after the user reaches the final slide and taps "Got it". */
  onComplete?: () => void;
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
  onOpenPoints,
}: {
  slide: RewardsHelpSlide;
  isActive: boolean;
  playbackSession: number;
  onOpenPoints: () => void;
}) => {
  return (
    <View style={{ width: SCREEN_WIDTH, height: '100%' }}>
      <View className="flex-1 items-center justify-center">
        <VideoIllustration
          source={SLIDE_ANIMATIONS[slide.key]}
          isActive={isActive}
          restartKey={playbackSession}
          loop={slide.key === 'tiers' || slide.key === 'perks'}
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
          {slide.key === 'rewards' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="How to earn points?"
              hitSlop={8}
              onPress={onOpenPoints}
              className="mt-2 transition-all active:opacity-70"
            >
              <Text
                className="text-center text-base text-white/70 underline"
                style={{
                  fontFamily: 'MonaSans_700Bold',
                  fontWeight: '700',
                  lineHeight: 18,
                }}
              >
                How to earn points?
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

/**
 * Rewards explainer carousel (Figma 20609-5524 / 20609-5615 / 21351-689).
 * Uses the same native pager, composition, and controls as Savings help.
 *
 * Each illustration is a single-play H.264 clip, hardware decoded rather than
 * decoded frame by frame on the main thread. Its first frame stays visible
 * until the modal is presented. Button navigation starts the incoming slide
 * immediately; a manual swipe starts it as it crosses halfway into view.
 * Returning to a page replays it from frame zero. Tiers uses the complete
 * seven-second Figma morph timeline and loops without swapping players.
 */
const RewardsHelpModal = ({ isOpen, onClose, onComplete = onClose }: RewardsHelpModalProps) => {
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<ScrollView>(null);
  const navigationTargetRef = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const [isPresented, setIsPresented] = useState(false);
  const [isPointsOpen, setIsPointsOpen] = useState(false);
  const [playbackSession, setPlaybackSession] = useState(0);
  const slide = REWARDS_HELP_SLIDES[index];
  const isLastSlide = index === REWARDS_HELP_SLIDES.length - 1;

  useEffect(() => {
    if (!isOpen) {
      navigationTargetRef.current = null;
      setIsPresented(false);
      setIsPointsOpen(false);
      setPlaybackSession(session => session + 1);
      return;
    }

    navigationTargetRef.current = null;
    setIndex(0);
    const frame = requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: 0, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const goToSlide = useCallback((targetIndex: number) => {
    // Start the incoming illustration when navigation begins. Waiting for the
    // pager to cross its midpoint leaves the next slide paused while it opens.
    navigationTargetRef.current = targetIndex;
    setIndex(targetIndex);
    pagerRef.current?.scrollTo({
      x: targetIndex * SCREEN_WIDTH,
      animated: true,
    });
  }, []);

  const handleNext = useCallback(() => {
    if (navigationTargetRef.current !== null) return;

    if (isLastSlide) {
      onComplete();
      return;
    }
    goToSlide(index + 1);
  }, [goToSlide, index, isLastSlide, onComplete]);

  // Activate the nearest page while it moves into view. Waiting for momentum
  // to end can leave an incoming video's first frame paused for several
  // seconds after a manual swipe, especially on web.
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const navigationTarget = navigationTargetRef.current;

    // Scroll events begin at the outgoing page during an animated scrollTo.
    // Keep the requested page active until the pager reaches its destination.
    if (navigationTarget !== null) {
      if (Math.abs(offsetX - navigationTarget * SCREEN_WIDTH) < 1) {
        navigationTargetRef.current = null;
      }
      setIndex(currentIndex =>
        currentIndex === navigationTarget ? currentIndex : navigationTarget,
      );
      return;
    }

    const targetIndex = Math.round(offsetX / SCREEN_WIDTH);
    const boundedIndex = Math.max(0, Math.min(targetIndex, REWARDS_HELP_SLIDES.length - 1));
    setIndex(currentIndex => (currentIndex === boundedIndex ? currentIndex : boundedIndex));
  }, []);

  const handleOpenPoints = useCallback(() => {
    setIsPointsOpen(true);
  }, []);
  const handleRequestClose = useCallback(() => {
    if (isPointsOpen) {
      setIsPointsOpen(false);
      return;
    }

    onClose();
  }, [isPointsOpen, onClose]);

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onShow={() => setIsPresented(true)}
      onRequestClose={handleRequestClose}
    >
      {/* Native modals have their own window on Android, so they also need
          their own gesture root. The local sheet provider keeps its portal
          above this modal instead of behind it at the app root. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
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
              onScroll={handleScroll}
              onMomentumScrollEnd={handleScroll}
              scrollEventThrottle={16}
              className="flex-1"
              contentContainerStyle={{ alignItems: 'flex-start' }}
            >
              {REWARDS_HELP_SLIDES.map((item, itemIndex) => (
                <HelpPage
                  key={item.key}
                  slide={item}
                  isActive={isOpen && isPresented && !isPointsOpen && itemIndex === index}
                  playbackSession={playbackSession}
                  onOpenPoints={handleOpenPoints}
                />
              ))}
            </ScrollView>

            <View className="flex-row items-center justify-center gap-[6px] pb-6">
              {REWARDS_HELP_SLIDES.map((item, itemIndex) => (
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

          <TierPointsSheet open={isPointsOpen} onOpenChange={setIsPointsOpen} />
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default RewardsHelpModal;
