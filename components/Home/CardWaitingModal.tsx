import { ImageSourcePropType, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
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
        {/* Back arrow */}
        <View className="px-[18px] pb-2 pt-2">
          <Pressable
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/10 web:hover:bg-white/15"
          >
            <ArrowLeft color="#ffffff" size={22} />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Card hero — already faded into #111 in the asset */}
          <Image
            source={getAsset('images/card-waiting-hero.png')}
            style={{ width: '100%', aspectRatio: 402 / 268 }}
            contentFit="contain"
          />

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

        {/* Pinned CTA */}
        <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: insets.bottom + 24 }}>
          <Button
            variant="brand"
            className="h-[50px] w-full rounded-full border-0 active:opacity-90"
            onPress={handleVerify}
          >
            <Text className="text-[16px] font-semibold text-black">Verify now</Text>
          </Button>
        </View>
      </View>
    </ResponsiveModal>
  );
};

export default CardWaitingModal;
