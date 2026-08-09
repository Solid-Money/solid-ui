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
  iconLayers: {
    asset: AssetPath;
    height: number;
    left: number;
    top: number;
    width: number;
  }[];
}

const POINTS_METHODS: PointsMethod[] = [
  {
    title: 'Save',
    description: '1 point/hour for\nevery $1 deposited',
    iconLayers: [
      {
        asset: 'images/rewards-tiers/points-save.svg',
        width: 19.4179,
        height: 22.5652,
        left: 15.2911,
        top: 13.7174,
      },
    ],
  },
  {
    title: 'Spend',
    description: '1 point per\n$1 spent',
    iconLayers: [
      {
        asset: 'images/rewards-tiers/points-spend.svg',
        width: 22.9799,
        height: 18.7839,
        left: 13.5101,
        top: 15.6081,
      },
    ],
  },
  {
    title: 'Invite friends',
    description: 'Earn 10% of their\ndaily points',
    iconLayers: [
      {
        asset: 'images/rewards-tiers/points-invite-left.svg',
        width: 11.3828,
        height: 13.8528,
        left: 10.25,
        top: 18.42,
      },
      {
        asset: 'images/rewards-tiers/points-invite-middle.svg',
        width: 14.2376,
        height: 17.4215,
        left: 16.07,
        top: 16.49,
      },
      {
        asset: 'images/rewards-tiers/points-invite-right.svg',
        width: 16.6532,
        height: 20.441,
        left: 23.1,
        top: 15.4,
      },
    ],
  },
  {
    title: 'Swap',
    description: '1 point per\n$1 swapped',
    iconLayers: [
      {
        asset: 'images/rewards-tiers/points-swap.svg',
        width: 27.4014,
        height: 26.776,
        left: 11.2993,
        top: 11.612,
      },
    ],
  },
];

const PointsCell = ({ method, bottom }: { method: PointsMethod; bottom?: boolean }) => {
  return (
    <View
      className="w-1/2 items-center"
      style={{
        height: bottom ? 177 : 169,
        paddingTop: bottom ? 31 : 23,
      }}
    >
      <View className="relative size-[50px] rounded-full bg-white/10">
        {method.iconLayers.map(layer => (
          <Image
            key={layer.asset}
            source={getAsset(layer.asset)}
            alt=""
            contentFit="fill"
            style={{
              position: 'absolute',
              width: layer.width,
              height: layer.height,
              left: layer.left,
              top: layer.top,
            }}
          />
        ))}
      </View>
      <Text
        className="mt-2 text-center text-white"
        style={{
          fontFamily: 'MonaSans_600SemiBold',
          fontSize: 16,
          lineHeight: 17,
        }}
      >
        {method.title}
      </Text>
      <Text
        className="mt-1 text-center text-white/70"
        style={{
          fontFamily: 'MonaSans_500Medium',
          fontSize: 14,
          lineHeight: 17,
        }}
      >
        {method.description}
      </Text>
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
        lineHeight: 30,
      }}
    >
      How do you{'\n'}earn points?
    </Text>
    <Text
      className="mt-[10px] w-[284px] text-center text-white/70"
      style={{
        fontFamily: 'MonaSans_400Regular',
        fontSize: 16,
        lineHeight: 18,
      }}
    >
      Earn points for every action you take with Solid and unlock rewards
    </Text>

    <View className="mt-9 h-[346px] w-full overflow-hidden rounded-[23px] bg-[#2B2B2B]">
      <View className="flex-row">
        <PointsCell method={POINTS_METHODS[0]} />
        <PointsCell method={POINTS_METHODS[1]} />
      </View>
      <View className="h-px bg-white/10" />
      <View className="flex-row">
        <PointsCell method={POINTS_METHODS[2]} bottom />
        <PointsCell method={POINTS_METHODS[3]} bottom />
      </View>
      <View className="absolute bottom-0 left-1/2 top-0 w-px bg-white/10" />
    </View>

    <Button
      variant="brand"
      accessibilityRole="button"
      accessibilityLabel="Close points information"
      onPress={onClose}
      className="mt-[31px] w-full transition-all active:scale-95 active:opacity-80"
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
