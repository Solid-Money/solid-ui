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
/** The card never comes closer than this to the top of the screen (and, from `md` up, the bottom). */
const CARD_SCREEN_MARGIN = 24;

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
  // The page width the pager was last placed at, null until the first time.
  // Until it is placed at the current width, its scroll events are ignored:
  // before the first placement they would move a linked slide back to the
  // first, and after a resize they carry the old width's offset, which read
  // at the new width names a neighbouring slide.
  const placedWidthRef = useRef<number | null>(null);
  // A native scroll event is a snapshot that can arrive late: one sent before a
  // rotation can land after the pager has been placed at the new width, at any
  // time. So on native the slide follows only the user's own swipe, from the
  // drag until the pager comes to rest. React Native Web reads the live offset
  // as it dispatches, so there every scroll event counts (a trackpad swipe
  // sends no drag events).
  const followsEveryScroll = Platform.OS === 'web';
  const isSwipingRef = useRef(false);
  const [isClosing, setIsClosing] = useState(false);
  const closedRef = useRef(false);

  const step = steps[Math.min(activeIndex, steps.length - 1)];
  const cta = step ? slideCta(step) : null;
  const isLast = activeIndex >= steps.length - 1;

  // Mounted only while open (see LazyWhatsNewModal), so once per showing, with
  // the slide it opened on: 1 normally, the linked one from a push.
  useEffect(() => {
    if (isOpen) {
      track(TRACKING_EVENTS.WHATS_NEW_VIEWED, {
        ...whatsNewViewedProps(whatsNew, 'popup'),
        step: startIndex + 1,
      });
    }
  }, [isOpen, startIndex, whatsNew]);

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

  // Puts the pager on the active slide whenever its slides are laid out. The
  // first time, that is the slide a link named (contentOffset covers iOS; web
  // and Android only scroll once there is content to scroll). After a rotation
  // or a window resize it keeps the slide the user was on.
  const placePager = useCallback(() => {
    if (!layout.pageWidth) return;
    const index = placedWidthRef.current === null ? startIndex : activeIndex;
    pagerRef.current?.scrollTo({ x: index * layout.pageWidth, animated: false });
    placedWidthRef.current = layout.pageWidth;
  }, [activeIndex, layout.pageWidth, startIndex]);

  // The nearest page to an offset the user scrolled to becomes the slide.
  const followOffset = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!layout.pageWidth || placedWidthRef.current !== layout.pageWidth) return;
      if (!followsEveryScroll && !isSwipingRef.current) return;
      const index = Math.round(event.nativeEvent.contentOffset.x / layout.pageWidth);
      const bounded = Math.max(0, Math.min(index, steps.length - 1));
      setActiveIndex(current => (current === bounded ? current : bounded));
    },
    [followsEveryScroll, layout.pageWidth, steps.length],
  );

  // A swipe: the drag, then the momentum that snaps it to a page, if any.
  const handleSwipeStart = useCallback(() => {
    isSwipingRef.current = true;
  }, []);
  // Where the pager came to rest ends the swipe.
  const handleSwipeEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      followOffset(event);
      isSwipingRef.current = false;
    },
    [followOffset],
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
  // The media is capped to the screen, but an admin's title and text are not:
  // on a short screen the card stops at the screen's edge and its body scrolls,
  // so the button (and on a phone the close X, which stays above) is reachable.
  const bottomGap = Math.max(insets.bottom, 16);
  const cardMaxHeight = isWide
    ? screenHeight - CARD_SCREEN_MARGIN * 2
    : screenHeight - insets.top - CARD_SCREEN_MARGIN - bottomGap;
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
          isWide ? styles.centered : { justifyContent: 'flex-end', paddingBottom: bottomGap },
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
              maxHeight: Math.max(cardMaxHeight, 0),
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

          <ScrollView
            style={styles.cardBody}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
          >
            <View>
              <ScrollView
                ref={pagerRef}
                horizontal
                pagingEnabled
                bounces={false}
                overScrollMode="never"
                showsHorizontalScrollIndicator={false}
                scrollEnabled={steps.length > 1}
                onScroll={followOffset}
                onScrollBeginDrag={handleSwipeStart}
                // Released on a page: no momentum follows.
                onScrollEndDrag={handleSwipeEnd}
                onMomentumScrollBegin={handleSwipeStart}
                onMomentumScrollEnd={handleSwipeEnd}
                scrollEventThrottle={16}
                style={{ width: layout.pageWidth }}
                // Opens on the linked slide without first drawing slide 1.
                contentOffset={{ x: startIndex * layout.pageWidth, y: 0 }}
                onContentSizeChange={placePager}
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
          </ScrollView>
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
  // Shrinks to fit the card's height cap, and scrolls only when it has to.
  cardBody: { flexGrow: 0, flexShrink: 1 },
  // Over the media's top-right corner, 16pt in.
  wideClose: { position: 'absolute', top: 16, right: 16 },
});

export default WhatsNewModal;
