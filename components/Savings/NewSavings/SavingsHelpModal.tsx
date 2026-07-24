import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check, ChevronsLeftRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { type AssetPath, getAsset } from '@/lib/assets';

import { SAVINGS_HELP_SLIDES, SavingsHelpSlide } from './savingsHelpData';
import SavingsHelpGlow from './SavingsHelpGlow';

const MODAL_BACKGROUND = '#0f0f10';
const DOT_TRANSITION_MS = 250;
const SLIDE_DURATION = 260;
const SLIDE_EASING = Easing.out(Easing.cubic);
const SWIPE_DISTANCE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 400;
const SCREEN_WIDTH = Dimensions.get('window').width;
// Dampens the drag past the first/last slide so it feels like it's resisting.
const RUBBER_BAND_FACTOR = 0.3;
const ILLUSTRATION_HEIGHT = 320;
// The "Watch it grow" slide layers a phone mockup behind the earnings card
// (Figma 20721:7409), so it needs a taller illustration zone than the other
// two slides' simpler icon/card illustrations.
const GROW_ILLUSTRATION_HEIGHT = 420;
// Natural aspect ratio (width / height) of the exported phone mockup image.
const PHONE_ASPECT_RATIO = 703 / 1467;
const PHONE_WIDTH = 210;

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

interface TokenRowData {
  name: string;
  symbol: string;
  icon: AssetPath;
  selected: boolean;
}

// Figma "Recent activity" rows (20720:6753/6802/6831) — USDC pre-selected.
const TOKEN_ROWS: TokenRowData[] = [
  { name: 'USDC', symbol: 'USDC', icon: 'images/usdc.png', selected: true },
  { name: 'Ethereum', symbol: 'ETH', icon: 'images/eth.png', selected: false },
  { name: 'FUSE', symbol: 'FUSE', icon: 'images/fuse.png', selected: false },
];

const TokenRow = ({ name, symbol, icon, selected }: TokenRowData) => (
  <View className="w-full flex-row items-center rounded-full bg-white/10 px-[19px] py-4">
    <Image
      source={getAsset(icon)}
      style={{ width: 50, height: 50, borderRadius: 25 }}
      contentFit="cover"
    />
    <View className="ml-4 flex-1">
      <Text className="text-[18px] font-semibold text-white">{name}</Text>
      <Text className="text-[16px] text-white/50">{symbol}</Text>
    </View>
    {selected ? (
      <View className="h-[25px] w-[25px] items-center justify-center rounded-full bg-white">
        <Check size={14} color="#000000" strokeWidth={3} />
      </View>
    ) : (
      <View className="h-[25px] w-[25px] rounded-full border-2 border-white/15" />
    )}
  </View>
);

const DepositIllustration = () => (
  <View className="w-full max-w-[345px] gap-[15px] px-6">
    {TOKEN_ROWS.map(row => (
      <TokenRow key={row.name} {...row} />
    ))}
  </View>
);

const PHONE_HEIGHT = PHONE_WIDTH / PHONE_ASPECT_RATIO;

const GrowIllustration = () => (
  <View style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
    <Image
      source={getAsset('images/savings-help-earn-phone.png')}
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        marginLeft: -PHONE_WIDTH / 2,
        width: PHONE_WIDTH,
        height: PHONE_HEIGHT,
      }}
      contentFit="contain"
    />
    {/* Fades the phone mockup into the background beneath the earnings card */}
    <LinearGradient
      colors={['transparent', MODAL_BACKGROUND]}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200 }}
    />

    <View className="absolute left-1/2 w-[316px] -translate-x-1/2" style={{ top: 110 }}>
      <Image
        source={getAsset('images/savings-grow.png')}
        style={{ width: '100%', height: 206 }}
        contentFit="fill"
      />
    </View>
  </View>
);

const WithdrawIllustration = () => (
  <Image
    source={getAsset('images/savings-help-withdraw-check.svg')}
    style={{ width: 169, height: 169 }}
    contentFit="contain"
  />
);

const SLIDE_ILLUSTRATIONS: Record<string, () => React.JSX.Element> = {
  deposit: DepositIllustration,
  grow: GrowIllustration,
  withdraw: WithdrawIllustration,
};

const HelpPage = ({ slide }: { slide: SavingsHelpSlide }) => {
  const Illustration = SLIDE_ILLUSTRATIONS[slide.key];
  const illustrationHeight = slide.key === 'grow' ? GROW_ILLUSTRATION_HEIGHT : ILLUSTRATION_HEIGHT;

  return (
    <View style={{ width: SCREEN_WIDTH }}>
      <View style={{ height: illustrationHeight }} className="items-center justify-center">
        <View className="absolute inset-0 items-center justify-center">
          <View style={{ width: '115%', height: '115%' }}>
            <SavingsHelpGlow color={slide.glowColor} />
          </View>
        </View>
        <Illustration />
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
 * Uses React Native's native `Modal` (its own OS-level window) rather than the
 * shared Dialog/ResponsiveModal, so it reliably covers the tab bar and the
 * Savings screen's glass navbar instead of sitting behind them.
 */
const SavingsHelpModal = ({ isOpen, onClose }: SavingsHelpModalProps) => {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const slide = SAVINGS_HELP_SLIDES[index];
  const isLastSlide = index === SAVINGS_HELP_SLIDES.length - 1;

  const translateX = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // The native Modal keeps its children mounted while hidden, so reset the
  // pager back to the first slide (instantly, no animation) each time it
  // opens rather than leaving it wherever it was left last time.
  useEffect(() => {
    if (isOpen) {
      setIndex(0);
      translateX.value = 0;
    }
  }, [isOpen, translateX]);

  useEffect(() => {
    if (isDragging.value) return;
    translateX.value = withTiming(-index * SCREEN_WIDTH, {
      duration: SLIDE_DURATION,
      easing: SLIDE_EASING,
    });
  }, [index, translateX, isDragging]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      onClose();
      return;
    }
    setIndex(current => current + 1);
  }, [isLastSlide, onClose]);

  // Only horizontal drags trigger a slide change; vertical drags are ignored.
  // onUpdate follows the finger in real time (with rubber-banding past the
  // first/last slide); onEnd either continues on to the next/previous slide
  // or snaps back to the current one.
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet';
      isDragging.value = true;
    })
    .onUpdate(event => {
      'worklet';
      let dx = event.translationX;
      if (index === 0 && dx > 0) dx *= RUBBER_BAND_FACTOR;
      if (index === SAVINGS_HELP_SLIDES.length - 1 && dx < 0) dx *= RUBBER_BAND_FACTOR;
      translateX.value = -index * SCREEN_WIDTH + dx;
    })
    .onEnd(event => {
      'worklet';
      const isSwipeLeft =
        event.translationX < -SWIPE_DISTANCE_THRESHOLD ||
        event.velocityX < -SWIPE_VELOCITY_THRESHOLD;
      const isSwipeRight =
        event.translationX > SWIPE_DISTANCE_THRESHOLD || event.velocityX > SWIPE_VELOCITY_THRESHOLD;

      let targetIndex = index;
      if (isSwipeLeft && index < SAVINGS_HELP_SLIDES.length - 1) targetIndex = index + 1;
      else if (isSwipeRight && index > 0) targetIndex = index - 1;

      translateX.value = withTiming(
        -targetIndex * SCREEN_WIDTH,
        { duration: SLIDE_DURATION, easing: SLIDE_EASING },
        finished => {
          if (finished && targetIndex !== index) {
            scheduleOnRN(setIndex, targetIndex);
          }
        },
      );
    })
    .onFinalize(() => {
      'worklet';
      isDragging.value = false;
    });

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
          <GestureDetector gesture={swipeGesture}>
            <Animated.View
              style={[
                { flexDirection: 'row', width: SCREEN_WIDTH * SAVINGS_HELP_SLIDES.length },
                rowStyle,
              ]}
            >
              {SAVINGS_HELP_SLIDES.map(s => (
                <HelpPage key={s.key} slide={s} />
              ))}
            </Animated.View>
          </GestureDetector>
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
