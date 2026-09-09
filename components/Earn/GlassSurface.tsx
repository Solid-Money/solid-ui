import { type ReactNode } from 'react';
import { Platform, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

// Web gets the blur straight from CSS; it composites against whatever the
// element sits on, which is exactly the tile art behind these surfaces.
const WEB_BACKDROP =
  Platform.OS === 'web'
    ? ({
        backdropFilter: 'saturate(180%) blur(14px)',
        WebkitBackdropFilter: 'saturate(180%) blur(14px)',
      } as unknown as ViewStyle)
    : undefined;

interface GlassSurfaceProps {
  /** Matches the surface's own corner radius so the blur clips cleanly. */
  radius: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

/**
 * Frosted "liquid glass" surface for the chips sitting on the textured vault
 * tiles: a blurred backdrop, a light tint lifting it off near-black art, and a
 * brighter top edge for the refracted rim.
 *
 * Android is tint-and-rim only — its BlurView needs a `blurTarget` view that a
 * chip nested inside a tile has no way to reach — which still reads as glass
 * because the art behind these is almost uniformly dark.
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
      WEB_BACKDROP,
      style,
    ]}
  >
    {Platform.OS === 'ios' && (
      <BlurView intensity={24} tint="light" pointerEvents="none" style={StyleSheet.absoluteFill} />
    )}

    <LinearGradient
      colors={['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.06)']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />

    {children}
  </View>
);
