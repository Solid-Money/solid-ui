import React from 'react';
import { ImageSourcePropType, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';

const ICON_SIZE = 28;
/** How far each circle slides under the one before it. */
const OVERLAP = 9;
/** Matches `bg-card`, so the circles read as cut out of the row behind them. */
const RING_COLOR = '#1C1C1C';

const CIRCLE_STYLE = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  borderRadius: ICON_SIZE / 2,
  borderWidth: 1.5,
  borderColor: RING_COLOR,
};

type DepositIconClusterProps = {
  /** Sample of what the method accepts — token logos, currency flags. */
  icons: ImageSourcePropType[];
  /** Everything not shown, rendered as a trailing "+N" circle. Hidden at zero. */
  overflowCount?: number;
};

/**
 * The overlapping-circle icon the "Deposit with" rows carry instead of a single
 * glyph: a few of the assets or currencies the method accepts, with a "+N"
 * circle standing in for the rest.
 */
const DepositIconCluster = ({ icons, overflowCount = 0 }: DepositIconClusterProps) => (
  <View className="flex-row items-center">
    {icons.map((icon, index) => (
      <View
        key={index}
        style={{ marginLeft: index === 0 ? 0 : -OVERLAP, zIndex: icons.length - index }}
      >
        <Image source={icon} style={CIRCLE_STYLE} contentFit="cover" />
      </View>
    ))}
    {overflowCount > 0 ? (
      <View
        className="items-center justify-center bg-[#333333]"
        style={{ ...CIRCLE_STYLE, marginLeft: -OVERLAP }}
      >
        <Text className="text-xs font-medium leading-none text-white/70">{`+${overflowCount}`}</Text>
      </View>
    ) : null}
  </View>
);

export default DepositIconCluster;
