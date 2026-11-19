import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { VideoLayer } from '@/components/WhatsNew/WhatsNewMedia';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/analytics';
import { WhatsNew, WhatsNewStep } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  carouselLayout,
  openWhatsNewLink,
  slideCta,
  type WhatsNewDismissMethod,
  whatsNewEventBase,
  whatsNewViewedProps,
} from '@/lib/whatsNew';

/** Jayant's design (T-68): a dark green-black card with a hairline border. */
const CARD_BACKGROUND = '#151918';
const MEDIA_BACKGROUND = '#0C0E0D';
const CARD_RADIUS = 24;
const MEDIA_RADIUS = 16;
/** Same backdrop as the single image or video. */
const BACKDROP = 'rgba(0, 0, 0, 0.7)';
const MEDIA_CORNERS = { borderRadius: MEDIA_RADIUS };

interface WhatsNewModalProps {
  whatsNew: WhatsNew;
  isOpen: boolean;
  onClose: () => void;
  /**
   * The slide to open on: 0 normally, the page a push or link named otherwise
   * (`?whatsNewStep=`). Read on mount; the lazy wrapper remounts this for a
   * different page, so every opening starts where it was asked to.
   */
  initialStep?: number;
}

interface SlideProps {
  step: WhatsNewStep;
  width: number;
  mediaHeight: number;
  textInset: number;
  isWide: boolean;
  /** Only the slide on screen plays its video. */
  isActive: boolean;
}

/** One slide: the image or a short muted video, then the label, title and text. */
const Slide = ({ step, width, mediaHeight, textInset, isWide, isActive }: SlideProps) => {
  const videoUrl = step.videoUrl?.trim();
  const eyebrow = step.eyebrow?.trim();

  return (
    <View style={{ width }}>
      <View style={[styles.media, { width, height: mediaHeight }]}>
        {videoUrl ? (
          <VideoLayer
            media={{
              type: 'video',
              url: videoUrl,
              posterUrl: step.imageUrl,
              width: 16,
              height: 9,
              alt: step.title,
            }}
            isActive={isActive}
            bottomInset={0}
            tapTarget={null}
            cornerStyle={MEDIA_CORNERS}
            contentFit="cover"
          />
        ) : (
          <Image
            source={{ uri: step.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessible={false}
          />
        )}
      </View>

      <View
        className={isWide ? 'mt-8' : 'mt-6 px-2'}
        style={{ paddingHorizontal: textInset || undefined }}
      >
        {eyebrow ? (
          <Text
            className={cn(
              'font-semibold text-brand',
              isWide ? 'text-[16px] leading-[22px]' : 'text-center text-[15px] leading-5',
            )}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          className={cn(
            'font-semibold text-white',
            eyebrow && (isWide ? 'mt-3' : 'mt-2'),
            isWide ? 'text-[36px] leading-[40px]' : 'text-center text-[26px] leading-[30px]',
          )}
        >
          {step.title}
        </Text>
        <Text
          className={cn(
            'text-white/80',
            isWide
              ? 'mt-3 text-[18px] leading-[26px]'
              : 'mt-2 text-center text-[16px] leading-[22px]',
          )}
        >
          {step.text}
        </Text>
      </View>
    </View>
  );
};

const Dots = ({ count, activeIndex }: { count: number; activeIndex: number }) =>
  count > 1 ? (
    <View className="flex-row items-center gap-1.5">
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          className={cn(
            'h-1.5 rounded-full',
            index === activeIndex ? 'w-[22px] bg-brand' : 'w-1.5 bg-white/25',
          )}
        />
      ))}
    </View>
  ) : null;

const ArrowButton = ({
  direction,
  disabled,
  onPress,
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={direction === 'previous' ? 'Previous' : 'Next'}
    accessibilityState={{ disabled }}
    className={cn(
      'h-9 w-9 items-center justify-center rounded-full',
      disabled ? 'bg-white/[0.04]' : 'bg-white/10 active:opacity-70 web:hover:bg-white/15',
    )}
  >
    {direction === 'previous' ? (
      <ChevronLeft size={18} color="#FFFFFF" strokeWidth={2} opacity={disabled ? 0.35 : 1} />
    ) : (
      <ChevronRight size={18} color="#FFFFFF" strokeWidth={2} opacity={disabled ? 0.35 : 1} />
    )}
  </Pressable>
);

/**
 * The What's New carousel, laid out as Jayant designed it (T-68).
 *
 * Phone: a card anchored to the bottom of the screen with a "What's new"
 * header and its close X, the slide's media (5:4), a centred label, title and
 * text, the dots, and one full-width button. Slides swipe.
 *
 * From `md` up: a centred 640-wide card, the X over the 16:9 media, the text
 * left-aligned, and ‹ dots › on the left of the bottom row with the button on
 * the right.
 *
 * The button is the slide's own (label and link) when it has one; otherwise it
 * moves to the next slide, and closes on the last. A slide's video plays muted
 * and on loop while it is on screen, with its poster until the first frame.
 */
const WhatsNewModal = ({ whatsNew, isOpen, onClose, initialStep = 0 }: WhatsNewModalProps) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { isScreenMedium: isWide } = useDimension();
  const insets = useSafeAreaInsets();
  const layout = carouselLayout({ width: screenWidth, height: screenHeight }, isWide);
  const steps = whatsNew.steps;
  const pagerRef = useRef<ScrollView>(null);
  const startIndex = Math.max(0, Math.min(initialStep, steps.length - 1));
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const activeIndexRef = useRef(startIndex);
  activeIndexRef.current = activeIndex;
  // Until the pager has been placed on the linked slide, its scroll events
  // (a web pager reports x = 0 as it mounts) must not move the slide back to 0.
  const positionedRef = useRef(startIndex === 0);
  const [isClosing, setIsClosing] = useState(false);
  const closedRef = useRef(false);

  const step = steps[Math.min(activeIndex, steps.length - 1)];
  const cta = step ? slideCta(step) : null;
  const isLast = activeIndex >= steps.length - 1;

  useEffect(() => {
    if (isOpen) {
      track(TRACKING_EVENTS.WHATS_NEW_VIEWED, {
        ...whatsNewViewedProps(whatsNew, 'popup'),
        step: activeIndexRef.current + 1,
      });
    }
  }, [isOpen, whatsNew]);

  const dismiss = (method: WhatsNewDismissMethod) => {
    if (closedRef.current) return;
    closedRef.current = true;
    setIsClosing(true);
    track(TRACKING_EVENTS.WHATS_NEW_DISMISSED, {
      ...whatsNewEventBase(whatsNew),
      format: 'carousel',
      method,
      step: activeIndex + 1,
    });
    onClose();
  };

  const openLink = (link: string) => {
    if (closedRef.current) return;
    closedRef.current = true;
    setIsClosing(true);
    track(TRACKING_EVENTS.WHATS_NEW_CLICKED, {
      ...whatsNewEventBase(whatsNew),
      format: 'carousel',
      link,
      step: activeIndex + 1,
    });
    // Close first so the user lands on the destination screen.
    onClose();
    openWhatsNewLink(link);
  };

  const goTo = useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(index, steps.length - 1));
      setActiveIndex(target);
      pagerRef.current?.scrollTo({ x: target * layout.pageWidth, animated: true });
    },
    [layout.pageWidth, steps.length],
  );

  // Puts the pager on the active slide once its width is known, and again when
  // the width changes: on mount that is the slide a link named; after a
  // rotation or a window resize it keeps the slide the user was on.
  useEffect(() => {
    if (!layout.pageWidth) return;
    const index = positionedRef.current ? activeIndexRef.current : startIndex;
    const frame = requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: index * layout.pageWidth, animated: false });
      positionedRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [layout.pageWidth, startIndex]);

  // Follows a swipe. Web doesn't always send momentum-end after a manual
  // scroll, so the nearest page is taken on every scroll event.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!layout.pageWidth || !positionedRef.current) return;
      const index = Math.round(event.nativeEvent.contentOffset.x / layout.pageWidth);
      const bounded = Math.max(0, Math.min(index, steps.length - 1));
      setActiveIndex(current => (current === bounded ? current : bounded));
    },
    [layout.pageWidth, steps.length],
  );

  const handlePrimary = () => {
    if (cta) {
      openLink(cta.link);
    } else if (isLast) {
      dismiss('close_button');
    } else {
      goTo(activeIndex + 1);
    }
  };

  const primaryLabel = cta?.label ?? (isLast ? 'Done' : 'Next');
  const entering = isWide
    ? FadeIn.duration(150)
    : FadeInDown.springify().stiffness(300).damping(12).mass(0.8);

  const closeButton = (
    <Pressable
      onPress={() => dismiss('close_button')}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={6}
      className={cn(
        'h-8 w-8 items-center justify-center rounded-full active:opacity-70',
        isWide ? 'bg-black/50 web:hover:bg-black/70' : 'bg-white/10 web:hover:bg-white/15',
      )}
    >
      <X size={18} color="#FFFFFF" strokeWidth={2} />
    </Pressable>
  );

  if (!step) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      // Android back; Esc on web.
      onRequestClose={() => dismiss(Platform.OS === 'web' ? 'esc' : 'back')}
    >
      <View
        style={[
          styles.root,
          isWide
            ? styles.centered
            : { justifyContent: 'flex-end', paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Pressable
          onPress={() => dismiss('backdrop')}
          style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP }]}
          accessible={false}
          importantForAccessibility="no"
        />

        <Animated.View
          entering={entering}
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              width: layout.cardWidth,
              padding: layout.padding,
              paddingTop: isWide ? layout.padding : 16,
              paddingBottom: isWide ? 33 : 21,
            },
          ]}
        >
          {isWide ? null : (
            <View className="mb-3 flex-row items-center justify-between pl-1">
              <Text className="text-[15px] font-medium text-white/70">What&apos;s new</Text>
              {closeButton}
            </View>
          )}

          <View>
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              bounces={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              scrollEnabled={steps.length > 1}
              onScroll={handleScroll}
              onMomentumScrollEnd={handleScroll}
              scrollEventThrottle={16}
              style={{ width: layout.pageWidth }}
              // Opens on the linked slide without first drawing slide 1.
              contentOffset={{ x: startIndex * layout.pageWidth, y: 0 }}
            >
              {steps.map((item, index) => (
                <Slide
                  key={`${index}-${item.imageUrl}`}
                  step={item}
                  width={layout.pageWidth}
                  mediaHeight={layout.mediaHeight}
                  textInset={layout.textInset}
                  isWide={isWide}
                  isActive={isOpen && !isClosing && index === activeIndex}
                />
              ))}
            </ScrollView>

            {isWide ? <View style={styles.wideClose}>{closeButton}</View> : null}
          </View>

          {isWide ? (
            <View
              className="mt-8 flex-row items-center justify-between"
              style={{ paddingHorizontal: layout.textInset }}
            >
              {steps.length > 1 ? (
                <View className="flex-row items-center gap-3.5">
                  <ArrowButton
                    direction="previous"
                    disabled={activeIndex === 0}
                    onPress={() => goTo(activeIndex - 1)}
                  />
                  <Dots count={steps.length} activeIndex={activeIndex} />
                  <ArrowButton
                    direction="next"
                    disabled={isLast}
                    onPress={() => goTo(activeIndex + 1)}
                  />
                </View>
              ) : (
                <View />
              )}
              <Button
                variant="brand"
                onPress={handlePrimary}
                className="h-12 rounded-full px-7"
                accessibilityLabel={primaryLabel}
              >
                <Text className="text-[17px] font-semibold text-black">{primaryLabel}</Text>
              </Button>
            </View>
          ) : (
            <>
              <View className="mt-6 items-center">
                <Dots count={steps.length} activeIndex={activeIndex} />
              </View>
              <Button
                variant="brand"
                onPress={handlePrimary}
                className="mt-6 h-[52px] w-full rounded-full"
                accessibilityLabel={primaryLabel}
              >
                <Text className="text-[17px] font-semibold text-black">{primaryLabel}</Text>
              </Button>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  centered: { justifyContent: 'center' },
  card: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  media: {
    backgroundColor: MEDIA_BACKGROUND,
    borderRadius: MEDIA_RADIUS,
    overflow: 'hidden',
  },
  // Over the media's top-right corner, 16pt in.
  wideClose: { position: 'absolute', top: 16, right: 16 },
});

export default WhatsNewModal;
