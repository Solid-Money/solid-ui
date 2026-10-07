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
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, X } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import VideoIllustration from '@/components/ui/video-illustration';
import { useDimension } from '@/hooks/useDimension';

import { SPEND_MODE_HELP_SLIDES, type SpendModeHelpSlide } from './spendModeHelpData';

const MODAL_BACKGROUND = '#111111';
const ILLUSTRATION_ASPECT_RATIO = 1320 / 1258;
const DOT_TRANSITION_MS = 250;
const DESKTOP_MODAL_WIDTH = 512;
const DESKTOP_MODAL_HEIGHT = 720;
const TITLE_SLOT_HEIGHT = 40;
const TITLE_LINE_HEIGHT = 34;
const BADGE_HEIGHT = 28;
const BADGE_TITLE_GAP = 16 - (TITLE_SLOT_HEIGHT - TITLE_LINE_HEIGHT) / 2;
const BODY_SLOT_HEIGHT = 72;
const COPY_BOTTOM_PADDING = 32;

const SLIDE_ANIMATIONS: Record<string, number> = {
  twoWays: require('@/assets/animations/credit-help-two-ways.mp4'),
  keepEarning: require('@/assets/animations/credit-help-keep-earning.mp4'),
  repayAnytime: require('@/assets/animations/credit-help-repay-anytime.mp4'),
};

const SLIDE_POSTERS: Record<string, number> = {
  twoWays: require('@/assets/animations/credit-help-two-ways-poster.png'),
  keepEarning: require('@/assets/animations/credit-help-keep-earning-poster.png'),
  repayAnytime: require('@/assets/animations/credit-help-repay-anytime-poster.png'),
};

interface SpendModeHelpModalProps {
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
  reduceMotion,
  playbackSession,
  pageWidth,
}: {
  slide: SpendModeHelpSlide;
  isActive: boolean;
  reduceMotion: boolean;
  playbackSession: number;
  pageWidth: number;
}) => {
  const illustrationHeight = pageWidth * ILLUSTRATION_ASPECT_RATIO;
  const verticalFadeSize = pageWidth * 0.18;
  const horizontalFadeSize = pageWidth * 0.07;

  return (
    <View style={{ width: pageWidth, height: '100%' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: pageWidth,
          height: illustrationHeight,
        }}
      >
        {reduceMotion ? (
          <Image
            source={SLIDE_POSTERS[slide.key]}
            contentFit="contain"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <VideoIllustration
            source={SLIDE_ANIMATIONS[slide.key]}
            isActive={isActive}
            restartKey={playbackSession}
            loop
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            surfaceType="textureView"
          />
        )}
        <LinearGradient
          pointerEvents="none"
          colors={['#111111', 'rgba(17, 17, 17, 0)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: verticalFadeSize }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(17, 17, 17, 0)', '#111111']}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: verticalFadeSize }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['#111111', 'rgba(17, 17, 17, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: horizontalFadeSize }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(17, 17, 17, 0)', '#111111']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: horizontalFadeSize }}
        />
      </View>

      <View
        className="items-center px-6"
        style={{
          position: 'absolute',
          top: '58%',
          left: 0,
          right: 0,
          paddingBottom: COPY_BOTTOM_PADDING,
          // Keep the title anchored while the badge uses normal flow; Yoga's
          // percentage bottom inset includes this container's padding differently.
          transform: slide.badge ? [{ translateY: -(BADGE_HEIGHT + BADGE_TITLE_GAP) }] : undefined,
        }}
      >
        {slide.badge ? (
          <Badge
            variant="brand"
            className="border-0 bg-brand/10 py-[6px] pl-[10px] pr-[12px]"
            style={{ marginBottom: BADGE_TITLE_GAP }}
          >
            <Text className="text-[14px] font-medium leading-[16px] text-brand">{slide.badge}</Text>
          </Badge>
        ) : null}
        <View className="w-full items-center justify-center" style={{ height: TITLE_SLOT_HEIGHT }}>
          <Text
            className="text-center text-[28px] font-semibold text-white"
            style={{ lineHeight: TITLE_LINE_HEIGHT }}
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
 * Spend Mode help carousel (Figma 27048:3993 / 27217:1250 / 27245:1250).
 * Opened from the "?" button in the Select spend mode sheet.
 *
 * All three slides are mounted side by side in a real pager row — swiping (or
 * tapping the CTA) drags/slides between actual pages rather than faking it
 * with a fade/slide of a single swapped-out content block.
 *
 * Each illustration is cropped from its exported Figma timeline. H.264 keeps
 * decoding off the JS thread. Only the visible page plays, and selecting it
 * restarts the animation.
 *
 * Uses React Native's native `Modal` (its own OS-level window) rather than the
 * shared Dialog/ResponsiveModal, so it reliably covers the card pane and tab bar.
 */
const SpendModeHelpModal = ({ isOpen, onClose }: SpendModeHelpModalProps) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { isScreenMedium } = useDimension();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktopPopup = Platform.OS === 'web' && isScreenMedium;
  const pageWidth = isDesktopPopup ? Math.min(DESKTOP_MODAL_WIDTH, windowWidth - 32) : windowWidth;
  const modalHeight = Math.min(DESKTOP_MODAL_HEIGHT, windowHeight - 32);
  const pagerRef = useRef<ScrollView>(null);
  const navigationTargetRef = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const [isPresented, setIsPresented] = useState(false);
  const [playbackSession, setPlaybackSession] = useState(0);
  const slide = SPEND_MODE_HELP_SLIDES[index];
  const isLastSlide = index === SPEND_MODE_HELP_SLIDES.length - 1;

  // Keep the illustrations paused during presentation. Reset while closed so
  // reopening cannot briefly show the previous slide or restart a playing video.
  useEffect(() => {
    navigationTargetRef.current = null;
    if (!isOpen) {
      setIsPresented(false);
      setIndex(0);
      setPlaybackSession(session => session + 1);
      return;
    }

    setIndex(0);
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
      if (!isOpen || !isPresented) return;

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
      const boundedIndex = Math.max(0, Math.min(targetIndex, SPEND_MODE_HELP_SLIDES.length - 1));
      setIndex(currentIndex => (currentIndex === boundedIndex ? currentIndex : boundedIndex));
    },
    [isOpen, isPresented, pageWidth],
  );

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent={isDesktopPopup}
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => {
        if (isOpen) setIsPresented(true);
      }}
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
            {SPEND_MODE_HELP_SLIDES.map((item, itemIndex) => (
              <HelpPage
                key={item.key}
                slide={item}
                isActive={isOpen && isPresented && itemIndex === index}
                reduceMotion={reduceMotion}
                playbackSession={playbackSession}
                pageWidth={pageWidth}
              />
            ))}
          </ScrollView>

          <View
            className="flex-row items-center justify-center gap-[6px]"
            style={{ height: 30, flexShrink: 0, transform: [{ translateY: -80 }] }}
          >
            {SPEND_MODE_HELP_SLIDES.map((item, itemIndex) => (
              <SlideDot key={item.key} active={itemIndex === index} />
            ))}
          </View>

          <View
            className="px-4"
            style={{ flexShrink: 0, paddingBottom: (isDesktopPopup ? 0 : insets.bottom) + 16 }}
          >
            <Button
              variant="brand"
              size="lg"
              onPress={handleNext}
              className="w-full rounded-full bg-brand"
              style={{ height: 50, flexShrink: 0 }}
            >
              <Text className="text-base font-semibold text-black">{slide.cta}</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SpendModeHelpModal;
