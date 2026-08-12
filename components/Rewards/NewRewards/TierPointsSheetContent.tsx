import { View } from 'react-native';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { type AssetPath, getAsset } from '@/lib/assets';
import { cn } from '@/lib/utils';

import PointsDrawerStarAnimation from './PointsDrawerStarAnimation';

interface TierPointsSheetContentProps {
  animationSession: number;
  onClose: () => void;
  /**
   * Bottom-sheet presentation: adds the top padding that clears the sheet's drag
   * handle. False inside a modal, which brings its own padding.
   */
  isSheet?: boolean;
}

interface PointsMethod {
  title: string;
  description: string;
  icon: {
    asset: AssetPath;
    height: number;
    width: number;
  };
}

const POINTS_METHODS: PointsMethod[] = [
  {
    title: 'Hold money, earn points',
    description:
      'All your balances count. Every $1 in your savings vault or card earns 1 point every hour.',
    icon: {
      asset: 'images/rewards-tiers/points-save.svg',
      width: 19.4179,
      height: 22.5652,
    },
  },
  {
    title: 'Move money, earn points',
    description:
      'Every $1 you spend with your card earns 1 point. Every $1 you swap earns 1 point too. It adds up fast.',
    icon: {
      asset: 'images/rewards-tiers/points-swap.svg',
      width: 27.4014,
      height: 26.776,
    },
  },
];

const PointsMethodRow = ({ method }: { method: PointsMethod }) => {
  return (
    <View className="flex-row items-start gap-4 overflow-hidden">
      <View className="h-[49px] w-[50px] shrink-0 items-center justify-center rounded-full bg-white/10">
        <Image
          source={getAsset(method.icon.asset)}
          alt=""
          contentFit="fill"
          style={{ width: method.icon.width, height: method.icon.height }}
        />
      </View>
      <View className="flex-1 gap-[6px] overflow-hidden">
        <Text
          className="text-white"
          style={{
            fontFamily: 'MonaSans_600SemiBold',
            fontSize: 16,
            lineHeight: 19,
          }}
        >
          {method.title}
        </Text>
        <Text
          className="text-white/70"
          style={{
            fontFamily: 'MonaSans_500Medium',
            fontSize: 14,
            lineHeight: 19,
          }}
        >
          {method.description}
        </Text>
      </View>
    </View>
  );
};

const TierPointsSheetContent = ({
  animationSession,
  onClose,
  isSheet = true,
}: TierPointsSheetContentProps) => (
  <View className={cn('items-center', isSheet && 'px-[34px] pt-[46px]')}>
    <PointsDrawerStarAnimation key={animationSession} />

    <Text
      className="mt-[31px] w-[219px] text-center text-white"
      style={{
        fontFamily: 'MonaSans_600SemiBold',
        fontSize: 30,
        lineHeight: 26,
      }}
    >
      How do you{'\n'}earn points?
    </Text>
    <Text
      className="mt-[9px] w-[284px] text-center text-white/70"
      style={{
        fontFamily: 'MonaSans_400Regular',
        fontSize: 16,
        lineHeight: 18,
      }}
    >
      Every dollar you hold and every dollar you move with Solid earns you points
    </Text>

    <View className="mt-[80px] h-[261px] w-full max-w-[352px] overflow-hidden rounded-[23px] bg-[#2B2B2B] px-5 py-6">
      <PointsMethodRow method={POINTS_METHODS[0]} />
      <View className="my-5 h-px bg-white/[0.08]" />
      <PointsMethodRow method={POINTS_METHODS[1]} />
    </View>

    <Button
      variant="brand"
      accessibilityRole="button"
      accessibilityLabel="Close points information"
      onPress={onClose}
      className="mt-[73px] w-full max-w-[352px] transition-all active:scale-95 active:opacity-80"
    >
      <Text
        className="text-center text-black"
        style={{
          fontFamily: 'MonaSans_600SemiBold',
          fontSize: 16,
          lineHeight: 20,
        }}
      >
        Close
      </Text>
    </Button>
  </View>
);

export default TierPointsSheetContent;
