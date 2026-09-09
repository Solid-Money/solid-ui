import { type ReactNode } from 'react';
import { Platform, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassSurfaceProps {
  /** Matches the surface's own corner radius so the blur clips cleanly. */
  radius: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

/**
 * Native build of the liquid-glass surface: a blurred backdrop, a light tint
 * lifting it off near-black art, and a lit top-left rim for pane thickness.
 * The web build refracts the backdrop as well — see `GlassSurface.web.tsx`.
 *
 * Android is tint-and-rim only. Its BlurView needs a `blurTarget` view that a
 * chip nested inside a tile has no way to reach, and the art behind these is
 * almost uniformly dark, so the blur would barely register regardless.
 */
export const GlassSurface = ({ radius, children, style, className }: GlassSurfaceProps) => (
  <View
    className={className}
    style={[
      {
        borderRadius: radius,
        // A fixed 1dp rim, not hairlineWidth: that resolves to 0.33 on iOS and
        // 1 on web, so the rim would read at very different weights.
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        overflow: 'hidden',
      },
      style,
    ]}
  >
    {/* A dark material, not a light one: these sit on near-black art, and a
        light tint blurs it to an opaque grey that washes out the surface and
        the green APY text with it. The rim below carries the glass instead. */}
    {Platform.OS === 'ios' && (
      <BlurView
        intensity={40}
        tint="systemUltraThinMaterialDark"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
    )}

    <LinearGradient
      colors={['rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0.02)']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />

    {/* Lit top-left edge, the strongest single cue that this is a pane with
        thickness rather than a flat translucent fill. */}
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.45)',
          borderLeftColor: 'rgba(255, 255, 255, 0.25)',
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
        },
      ]}
    />

    {children}
  </View>
);
