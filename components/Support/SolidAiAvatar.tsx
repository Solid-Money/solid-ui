import { memo, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Image } from 'expo-image';

import { getAsset } from '@/lib/assets';

import SolidAiGradient from './SolidAiGradient';

interface SolidAiAvatarProps {
  size?: number;
  /** Only the introduction's hero uses the outer green glow. */
  glow?: boolean;
}

/** One Figma avatar and moving gradient for the intro, header, replies and typing. */
function SolidAiAvatar({ size = 28, glow = false }: SolidAiAvatarProps) {
  const still = useReducedMotion();
  const rimId = `solid-ai-rim-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // The export includes the white shadow; the spark itself is 50% × 55%.
  const sparkWidth = size * 0.66;
  const sparkHeight = size * 0.71;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Solid AI"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#0A160C',
        boxShadow: glow ? `0px 0px ${size * 0.3}px rgba(148,242,127,0.28)` : undefined,
      }}
    >
      <View style={[StyleSheet.absoluteFill, styles.core, { borderRadius: size / 2 }]}>
        <SolidAiGradient size={size} still={still} />
        <Image
          source={getAsset('images/support/avatar-glass.svg')}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
          accessible={false}
        />
        <Svg
          pointerEvents="none"
          width={size}
          height={size}
          viewBox="0 0 88 88"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="white" stopOpacity={0.65} />
              <Stop offset="0.45" stopColor="white" stopOpacity={0.1} />
              <Stop offset="1" stopColor="white" stopOpacity={0.35} />
            </LinearGradient>
          </Defs>
          <Circle cx={44} cy={44} r={43.5} fill="none" stroke={`url(#${rimId})`} strokeWidth={1} />
        </Svg>
        <Image
          source={getAsset('images/support/avatar-spark.svg')}
          accessible={false}
          contentFit="fill"
          style={{
            position: 'absolute',
            left: (size - sparkWidth) / 2,
            top: (size - sparkHeight) / 2,
            width: sparkWidth,
            height: sparkHeight,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ core: { overflow: 'hidden' } });

export default memo(SolidAiAvatar);
