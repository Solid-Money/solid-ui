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

import { REWARDS_HELP_SLIDES, type RewardsHelpSlide } from './rewardsHelpData';

const MODAL_BACKGROUND = '#0f0f10';
const DOT_TRANSITION_MS = 250;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TITLE_SLOT_HEIGHT = 40;
const BODY_SLOT_HEIGHT = 72;
const COPY_BOTTOM_PADDING = 32;
const TIERS_INTRO_DURATION_MS = 7033;
const TIERS_SHADER_LOOP: AssetPath = 'animations/rewards-help-tiers-shader-loop.webp';

const SLIDE_ANIMATIONS: Record<string, AssetPath> = {
  rewards: 'animations/rewards-help-rewards.webp',
  tiers: 'animations/rewards-help-tiers.webp',
  perks: 'animations/rewards-help-perks.webp',
};

const startAnimation = (image: Image | null) => {
  if (!image) return;
  void image.startAnimating().catch(() => undefined);
};

interface RewardsHelpModalProps {
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
  slide: RewardsHelpSlide;
  isActive: boolean;
  playbackSession: number;
}) => {
  const introRef = useRef<Image>(null);
  const tiersLoopRef = useRef<Image>(null);
  const wasActiveRef = useRef(isActive);
  const [mountSession, setMountSession] = useState(0);
  const [isIntroLoaded, setIsIntroLoaded] = useState(false);
  const [isLoopReady, setIsLoopReady] = useState(false);
  const [shouldPlayLoop, setShouldPlayLoop] = useState(false);
  const isTiersSlide = slide.key === 'tiers';
  const showLoop = isTiersSlide && shouldPlayLoop && isLoopReady;

  useEffect(() => {
    setIsIntroLoaded(false);
    setIsLoopReady(false);
    setShouldPlayLoop(false);
  }, [playbackSession, slide.key]);

  useEffect(() => {
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = isActive;

    if (wasActive && !isActive) {
      setIsIntroLoaded(false);
      setIsLoopReady(false);
      setShouldPlayLoop(false);
      setMountSession(session => session + 1);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isTiersSlide || !isActive || !isIntroLoaded) return;

    const timeout = setTimeout(() => {
      setShouldPlayLoop(true);
    }, TIERS_INTRO_DURATION_MS);

    return () => clearTimeout(timeout);
  }, [isActive, isIntroLoaded, isTiersSlide]);

  useEffect(() => {
    if (isActive && isIntroLoaded && !showLoop) {
      startAnimation(introRef.current);
    }
  }, [isActive, isIntroLoaded, showLoop]);

  useEffect(() => {
    if (showLoop) {
      startAnimation(tiersLoopRef.current);
    }
  }, [showLoop]);

  return (
    <View style={{ width: SCREEN_WIDTH, height: '100%' }}>
      <View className="flex-1 items-center justify-center">
        {isTiersSlide && isIntroLoaded && (
          <Image
            ref={tiersLoopRef}
            key={`${slide.key}-loop-${playbackSession}-${mountSession}`}
            source={getAsset(TIERS_SHADER_LOOP)}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              opacity: showLoop ? 1 : 0,
            }}
            contentFit="contain"
            autoplay={false}
            onLoad={() => setIsLoopReady(true)}
          />
        )}

        {!showLoop && (
          <Image
            ref={introRef}
            key={`${slide.key}-intro-${playbackSession}-${mountSession}`}
            source={getAsset(SLIDE_ANIMATIONS[slide.key])}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            autoplay={false}
            onLoad={() => setIsIntroLoaded(true)}
          />
        )}
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
 * Rewards explainer carousel (Figma 20609-5524 / 20609-5615 / 21351-689).
 * Uses the same native pager, composition, and controls as Savings help.
 *
 * Each illustration starts with a single-play animated WebP. Its original
 * black frame stays visible until the modal or pager transition is complete,
 * then playback begins. Returning to a page remounts it from frame zero.
 * Tiers hands off to a preloaded shader-only loop after its shape morph ends.
 */
const RewardsHelpModal = ({ isOpen, onClose }: RewardsHelpModalProps) => {
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [isPresented, setIsPresented] = useState(false);
  const [playbackSession, setPlaybackSession] = useState(0);
  const slide = REWARDS_HELP_SLIDES[index];
  const isLastSlide = index === REWARDS_HELP_SLIDES.length - 1;

  useEffect(() => {
    if (!isOpen) {
      setIsPresented(false);
      setPlaybackSession(session => session + 1);
      return;
    }

    setIndex(0);
    const frame = requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: 0, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const goToSlide = useCallback((targetIndex: number) => {
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
    const boundedIndex = Math.max(0, Math.min(targetIndex, REWARDS_HELP_SLIDES.length - 1));
    setIndex(boundedIndex);
  }, []);

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onShow={() => setIsPresented(true)}
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
          {REWARDS_HELP_SLIDES.map((item, itemIndex) => (
            <HelpPage
              key={item.key}
              slide={item}
              isActive={isOpen && isPresented && itemIndex === index}
              playbackSession={playbackSession}
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
    </Modal>
  );
};

export default RewardsHelpModal;
