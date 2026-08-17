import { useEffect, useState } from 'react';
import { ActivityIndicator, ImageSourcePropType, Platform, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import PinnedActionModalLayout from '@/components/PinnedActionModalLayout';
import ResponsiveModal from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDimension } from '@/hooks/useDimension';
import { HomeSetupStep } from '@/hooks/useHomeSetupSteps';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { resolveCardCountry } from '@/lib/cardCountryGate';
import { hasCard, hasCardStatusWithRainApplication, hasPendingCard } from '@/lib/utils';

interface CardWaitingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** First incomplete setup step — its onPress starts verification. */
  firstIncomplete?: HomeSetupStep;
}

interface Benefit {
  /** Badge size — circles are 50×49, logo pills are 94×49 (Figma). */
  badgeWidth: number;
  content:
    | { type: 'text'; value: string }
    | { type: 'icon'; source: ImageSourcePropType; width: number; height: number };
  label: string;
}

// Mobile follows the platform's own wallet — Apple Pay on iOS, Google Pay
// everywhere else.
const WALLET_BENEFIT: Benefit =
  Platform.OS === 'ios'
    ? {
        badgeWidth: 94,
        content: {
          type: 'icon',
          source: getAsset('images/badge-apple-pay.svg'),
          width: 58,
          height: 25,
        },
        label: 'Apple Pay\nsupport',
      }
    : {
        badgeWidth: 94,
        content: {
          type: 'icon',
          source: getAsset('images/badge-google-pay.svg'),
          width: 63,
          height: 30,
        },
        label: 'Google Pay\nsupport',
      };

// Web can support both wallet providers, so it uses the combined badge and copy
// from Figma nodes 22052:933 and 22052:915 at every viewport width.
const WEB_WALLET_BENEFIT: Benefit = {
  badgeWidth: 134,
  content: {
    type: 'icon',
    source: getAsset('images/badge-apple-google-pay.png'),
    width: 134,
    height: 49,
  },
  label: 'Apple Pay &\nGoogle Pay support',
};

// Benefits grid — 2 columns × 3 rows, matching Figma node 20964:2674.
const BENEFITS: Benefit[] = [
  {
    badgeWidth: 50,
    content: { type: 'text', value: '5%' },
    label: 'Up to 5%\ncashback',
  },
  WALLET_BENEFIT,
  {
    badgeWidth: 94,
    content: {
      type: 'icon',
      source: getAsset('images/badge-visa-logo.svg'),
      width: 55,
      height: 28,
    },
    label: 'Free Visa\nvirtual card',
  },
  {
    badgeWidth: 50,
    content: {
      type: 'icon',
      source: getAsset('images/badge-globe-icon.svg'),
      width: 25,
      height: 25,
    },
    label: '175M merchants worldwide',
  },
  {
    badgeWidth: 50,
    content: {
      type: 'icon',
      source: getAsset('images/badge-star-icon.svg'),
      width: 26,
      height: 26,
    },
    label: 'Unlock tier\nrewards',
  },
  {
    badgeWidth: 50,
    content: {
      type: 'icon',
      source: getAsset('images/badge-usd-icon.svg'),
      width: 27,
      height: 27,
    },
    label: 'USD Personal account',
  },
];

const WEB_BENEFITS = BENEFITS.map((benefit, index) => (index === 1 ? WEB_WALLET_BENEFIT : benefit));

const BADGE_HEIGHT = 49;
const ROW_HEIGHT = 143;
const HAIRLINE = 'rgba(255,255,255,0.1)';
const CTA_HEIGHT = 50;

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
    <View
      className="items-center justify-center bg-white/10"
      style={{ width: benefit.badgeWidth, height: BADGE_HEIGHT, borderRadius: BADGE_HEIGHT / 2 }}
    >
      {benefit.content.type === 'text' ? (
        <Text className="text-[20px] font-bold text-white" style={{ lineHeight: 24 }}>
          {benefit.content.value}
        </Text>
      ) : (
        <Image
          source={benefit.content.source}
          style={{ width: benefit.content.width, height: benefit.content.height }}
          contentFit="contain"
        />
      )}
    </View>
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
  const router = useRouter();
  const { isDesktop } = useDimension();
  const [checkingCountry, setCheckingCountry] = useState(false);
  const { data: cardStatus } = useCardStatus();
  // Same escape hatch as `skipCountryCheck` in useActivateCard: someone holding
  // a card, waiting on one being issued, or already part-way through a Rain
  // application has cleared the country gate once and must not be bounced back
  // out of the flow.
  const skipCountryGate =
    hasCard(cardStatus) ||
    hasPendingCard(cardStatus) ||
    hasCardStatusWithRainApplication(cardStatus);
  const benefits = Platform.OS === 'web' ? WEB_BENEFITS : BENEFITS;

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

  // The country gate the old `/card` page's "Get your card" button ran (via
  // `/card/activate`) before anything else. The step actions below jump straight
  // into KYC / activation, so without this the country selection screen would
  // never be shown and KYC would start with no country to route the provider on.
  // The deposit step needs no card country, so it skips the gate.
  const handleVerify = async () => {
    if (checkingCountry) return;

    track(TRACKING_EVENTS.CARD_GET_CARD_PRESSED, {
      source: 'home_card_waiting_modal',
      step: firstIncomplete?.key,
    });

    if (!firstIncomplete || firstIncomplete.key === 'deposit' || skipCountryGate) {
      onClose();
      firstIncomplete?.onPress?.();
      return;
    }

    setCheckingCountry(true);
    try {
      const result = await resolveCardCountry('home_card_waiting_modal');

      // Close before navigating — the destination shouldn't mount under an open
      // modal (matches the previous close-then-act ordering).
      onClose();

      if (result === 'supported') {
        firstIncomplete.onPress?.();
      } else {
        router.push(path.CARD_COUNTRY_SELECTION);
      }
    } finally {
      setCheckingCountry(false);
    }
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
      contentClassName={
        isDesktop
          ? 'overflow-hidden bg-[#111]'
          : 'overflow-hidden bg-[#111] px-0 pb-0 pt-0 md:px-0 md:pt-0'
      }
    >
      <PinnedActionModalLayout
        onBack={onClose}
        actionFadeExtent={60}
        horizontalPadding={isDesktop ? 0 : 18}
        contentContainerStyle={{ paddingTop: 50 }}
        action={
          <Button
            variant="brand"
            className="w-full rounded-full border-0 active:opacity-90"
            style={{ height: CTA_HEIGHT }}
            onPress={handleVerify}
            disabled={checkingCountry}
          >
            {checkingCountry ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-[16px] font-semibold text-black">Verify now</Text>
            )}
          </Button>
        }
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
          className="text-center text-[30px] font-medium -tracking-[1px] text-white"
          style={{ lineHeight: 36, marginTop: 17 }}
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
        <View className={isDesktop ? 'mt-[51px]' : 'mt-[51px] px-[18px]'}>
          <View className="overflow-hidden rounded-[23px] bg-[#1C1C1C]">
            {[0, 2, 4].map((start, rowIndex) => (
              <View
                key={start}
                className="flex-row"
                style={
                  rowIndex < 2 ? { borderBottomWidth: 1, borderBottomColor: HAIRLINE } : undefined
                }
              >
                <BenefitCell benefit={benefits[start]} showRightBorder />
                <BenefitCell benefit={benefits[start + 1]} showRightBorder={false} />
              </View>
            ))}
          </View>
        </View>
      </PinnedActionModalLayout>
    </ResponsiveModal>
  );
};

export default CardWaitingModal;
