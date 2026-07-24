import { useEffect } from 'react';
import { ImageSourcePropType, Pressable, ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';

import ResponsiveModal from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { HomeSetupStep } from '@/hooks/useHomeSetupSteps';
import { getAsset } from '@/lib/assets';

interface CardWaitingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** First incomplete setup step — its onPress starts verification. */
  firstIncomplete?: HomeSetupStep;
}

interface Benefit {
  badge: ImageSourcePropType;
  /** Badge intrinsic size — circles are 50×49, logo pills are 94×49 (Figma). */
  badgeWidth: number;
  label: string;
}

// Benefits grid — 2 columns × 3 rows, matching Figma node 20609:4815.
const BENEFITS: Benefit[] = [
  { badge: getAsset('images/badge-cashback.png'), badgeWidth: 50, label: 'Up to 5%\ncashback' },
  { badge: getAsset('images/badge-gpay.png'), badgeWidth: 94, label: 'Google Pay\nsupport' },
  { badge: getAsset('images/badge-visa.png'), badgeWidth: 94, label: 'Free Visa\nvirtual card' },
  { badge: getAsset('images/badge-globe.png'), badgeWidth: 50, label: '+200M merchants worldwide' },
  { badge: getAsset('images/badge-star.png'), badgeWidth: 50, label: 'Unlock tier\nrewards' },
  { badge: getAsset('images/badge-usd.png'), badgeWidth: 50, label: 'USD Personal account' },
];

const BADGE_HEIGHT = 49;
const ROW_HEIGHT = 143;
const HAIRLINE = 'rgba(255,255,255,0.1)';
const MODAL_BACKGROUND = '#111111';
// Extra height the top/bottom gradients fade over, beyond their bar's own
// content — so scrolled content dims out smoothly instead of getting a hard
// clip (Figma node 20172:8367).
const FADE_EXTENT = 120;
const CTA_HEIGHT = 50;
const CTA_PADDING_TOP = 16;
const CTA_PADDING_BOTTOM = 35;

const BenefitCell = ({
  benefit,
  showRightBorder,
}: {
  benefit: Benefit;
  showRightBorder: boolean;
}) => (
  <View
    className="flex-1 items-center px-2 pt-[23px]"
    style={{
      height: ROW_HEIGHT,
      borderRightWidth: showRightBorder ? 1 : 0,
      borderRightColor: HAIRLINE,
    }}
  >
    <Image
      source={benefit.badge}
      style={{ width: benefit.badgeWidth, height: BADGE_HEIGHT }}
      contentFit="contain"
    />
    <Text
      className="mt-[9px] text-center text-[16px] font-medium text-white"
      style={{ lineHeight: 18 }}
    >
      {benefit.label}
    </Text>
  </View>
);

/**
 * "Your card is waiting" verification prompt (Figma node 20609-4395). Redesigned
 * replacement for {@link FinishSetupModal} — a card hero, a 2×3 benefits grid and
 * a pinned "Verify now" CTA. Kept as a separate component (new prefix) so the
 * original FinishSetupModal remains available.
 */
const CardWaitingModal = ({ isOpen, onClose, firstIncomplete }: CardWaitingModalProps) => {
  const insets = useSafeAreaInsets();

  // Hero entrance — card spins/settles in from Figma node 20964:2589: fades in,
  // rises 18px, scales up from 0.55 and un-tilts 8deg, with a spring settle.
  const heroOpacity = useSharedValue(0);
  const heroTranslateY = useSharedValue(18);
  const heroScale = useSharedValue(0.55);
  const heroRotate = useSharedValue(8);

  useEffect(() => {
    if (!isOpen) return;

    // Reset to the starting pose first — the modal (and these shared values)
    // stay mounted between opens, so without this the animation would run
    // from the previous end state to itself and appear to not play at all.
    heroOpacity.value = 0;
    heroTranslateY.value = 18;
    heroScale.value = 0.55;
    heroRotate.value = 8;

    heroOpacity.value = withTiming(0.8, { duration: 550, easing: Easing.out(Easing.cubic) });
    const spring = { damping: 14, stiffness: 90, mass: 1 };
    heroTranslateY.value = withSpring(0, spring);
    heroScale.value = withSpring(1, spring);
    heroRotate.value = withSpring(0, spring);
  }, [isOpen, heroOpacity, heroTranslateY, heroScale, heroRotate]);

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [
      { translateY: heroTranslateY.value },
      { scale: heroScale.value },
      { rotate: `${heroRotate.value}deg` },
    ],
  }));

  const handleVerify = () => {
    onClose();
    firstIncomplete?.onPress?.();
  };

  return (
    <ResponsiveModal
      currentModal={{ name: 'card_waiting', number: 1 }}
      previousModal={{ name: 'close', number: 0 }}
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      trigger={null}
      contentKey="card_waiting"
      shouldAnimate={false}
      hideHeader
      disableScroll
      fillViewportHeight
      containerClassName="gap-0"
      contentClassName="bg-[#111] px-0 pb-0 pt-0 md:px-0 md:pt-0"
    >
      <View className="flex-1">
        <ScrollView
          className="flex-1 pt-20"
          contentContainerStyle={{
            paddingBottom: CTA_PADDING_TOP + CTA_HEIGHT + insets.bottom + CTA_PADDING_BOTTOM + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Card hero — already faded into #111 in the asset */}
          <Animated.View style={heroAnimatedStyle}>
            <Image
              source={getAsset('images/card-waiting-hero.png')}
              style={{ width: '100%', aspectRatio: 402 / 300 }}
              contentFit="contain"
            />
          </Animated.View>

          <Text
            className="mt-[27px] text-center text-[30px] font-medium -tracking-[1px] text-white"
            style={{ lineHeight: 36 }}
          >
            Your card is waiting
          </Text>
          <View className="mt-[6px] items-center">
            <Text
              className="max-w-[315px] text-center text-[16px] text-white/70"
              style={{ lineHeight: 20 }}
            >
              One quick step to activate your card. Most people finish in under 3 minutes.
            </Text>
          </View>

          {/* Benefits grid */}
          <View className="mt-[51px] px-[18px]">
            <View
              className="overflow-hidden rounded-[23px] border"
              style={{ borderColor: HAIRLINE }}
            >
              {[0, 2, 4].map((start, rowIndex) => (
                <View
                  key={start}
                  className="flex-row"
                  style={
                    rowIndex < 2 ? { borderBottomWidth: 1, borderBottomColor: HAIRLINE } : undefined
                  }
                >
                  <BenefitCell benefit={BENEFITS[start]} showRightBorder />
                  <BenefitCell benefit={BENEFITS[start + 1]} showRightBorder={false} />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Back arrow — overlaid on the scrollable content so it fades in rather
            than clipping it (Figma node 20172:8367's tab-bar gradient) */}
        <LinearGradient
          colors={[MODAL_BACKGROUND, `${MODAL_BACKGROUND}00`]}
          pointerEvents="box-none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60 + FADE_EXTENT }}
        >
          <View className="px-[18px] pb-2 pt-2">
            <Pressable
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full bg-white/10 web:hover:bg-white/15"
            >
              <ArrowLeft color="#ffffff" size={22} />
            </Pressable>
          </View>
        </LinearGradient>

        {/* Pinned CTA — same overlay treatment on the bottom edge */}
        <LinearGradient
          colors={[`${MODAL_BACKGROUND}00`, MODAL_BACKGROUND]}
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: CTA_PADDING_TOP + CTA_HEIGHT + insets.bottom + CTA_PADDING_BOTTOM + FADE_EXTENT,
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              paddingHorizontal: 18,
              paddingTop: CTA_PADDING_TOP,
              paddingBottom: insets.bottom + CTA_PADDING_BOTTOM,
            }}
          >
            <Button
              variant="brand"
              className="h-[50px] w-full rounded-full border-0 active:opacity-90"
              onPress={handleVerify}
            >
              <Text className="text-[16px] font-semibold text-black">Verify now</Text>
            </Button>
          </View>
        </LinearGradient>
      </View>
    </ResponsiveModal>
  );
};

export default CardWaitingModal;
