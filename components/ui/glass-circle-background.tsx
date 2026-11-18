import { useId } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';

/**
 * Figma 28517:9259 and 27864:7418 share the same radial gradient and GLASS effect.
 * SVG approximates the reflection and softened rim; web also uses backdrop blur.
 * This is a decorative surface, not a refraction shader.
 */
const GlassCircleBackground = ({
  size,
  backgroundOpacity = 1,
}: {
  size: number;
  backgroundOpacity?: number;
}) => {
  const id = useId().replace(/:/g, '');
  const gradientId = `${id}-glass-circle-radial`;
  const rimId = `${id}-glass-circle-rim`;
  const lightId = `${id}-glass-circle-light`;
  const rimWidth = 1.6;
  // Web-only CSS, which React Native's ViewStyle doesn't declare
  const webGlassFrost =
    Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${(size * 3) / 44}px)`,
          WebkitBackdropFilter: `blur(${(size * 3) / 44}px)`,
        } as ViewStyle)
      : undefined;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[
        StyleSheet.absoluteFill,
        { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' },
        webGlassFrost,
      ]}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 44 44"
        opacity={backgroundOpacity}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id={gradientId} cx={22} cy={16} r={28} gradientUnits="userSpaceOnUse">
            <Stop offset={0} stopColor="#FFFFFF" stopOpacity={0.05} />
            <Stop offset={1} stopColor="#FFFFFF" stopOpacity={0.25} />
          </RadialGradient>
        </Defs>
        <Circle cx={22} cy={22} r={22} fill={`url(#${gradientId})`} />
      </Svg>
      <Svg width={size} height={size} viewBox="0 0 88 88" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={rimId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.09} />
            <Stop offset="0.75" stopColor="#FFFFFF" stopOpacity={0.02} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.075} />
          </SvgLinearGradient>
          <RadialGradient id={lightId} cx="12" cy="12" r="76" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.025} />
            <Stop offset="0.75" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={44} cy={44} r={44} fill={`url(#${lightId})`} />
        <Circle
          cx={44}
          cy={44}
          r={44 - rimWidth / 2}
          fill="none"
          stroke={`url(#${rimId})`}
          strokeWidth={rimWidth}
        />
      </Svg>
    </View>
  );
};

export default GlassCircleBackground;
