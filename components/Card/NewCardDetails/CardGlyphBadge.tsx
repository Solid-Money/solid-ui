import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

// Rendered sizes of the pre-rendered glass oval artwork (the PNGs are 2×).
const OVAL_WIDTH = 60;
const OVAL_SPACE_WIDTH = 107;
const OVAL_HEIGHT = 40;

interface CardGlyphBadgeProps {
  /** Last 4 digits of the card; when present the wider "space" oval is used and
   *  the digits are drawn in its empty area. */
  last4?: string;
}

const DotGlyph = () => (
  <View style={styles.dotGroup}>
    <View style={styles.dot} />
    <View style={styles.dot} />
    <View style={styles.dot} />
    <View style={styles.dot} />
  </View>
);

/**
 * Glass glyph oval on the bottom-left of the VISA Platinum card. The original
 * pre-rendered artwork supplies the frosted texture and edge refraction at 50%
 * opacity, while the dots and optional last four digits remain fully opaque.
 */
const CardGlyphBadge = ({ last4 }: CardGlyphBadgeProps) => {
  return (
    <View style={styles.anchor} pointerEvents="none">
      {last4 ? (
        <View style={styles.spaceOval}>
          <Image
            source={getAsset('images/card-oval-space.png')}
            style={[StyleSheet.absoluteFill, styles.glassArtwork]}
            contentFit="fill"
          />
          <DotGlyph />
          <View style={styles.digitsSlot}>
            <Text style={styles.digits}>{last4}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.dotsOval}>
          <Image
            source={getAsset('images/card-oval.png')}
            style={[StyleSheet.absoluteFill, styles.glassArtwork]}
            contentFit="fill"
          />
          <DotGlyph />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Figma puts the pill 5.2% of the card body's width from its left edge and 8.7%
  // of its height up from the bottom. visa-platinum-card.png wraps that body in a
  // baked-in shadow (5.575% of the image's width on the left, 9.91% of its height
  // at the bottom), and these percentages resolve against the IMAGE box — so the
  // design's offsets become 5.575 + 5.2×0.8885 = 10.2% and 9.91 + 8.7×0.827 = 17.1%.
  anchor: { position: 'absolute', left: '10.2%', bottom: '17.1%' },
  dotsOval: {
    borderRadius: 100,
    height: OVAL_HEIGHT,
    overflow: 'hidden',
    width: OVAL_WIDTH,
  },
  spaceOval: {
    borderRadius: 100,
    height: OVAL_HEIGHT,
    overflow: 'hidden',
    width: OVAL_SPACE_WIDTH,
  },
  glassArtwork: { opacity: 0.5 },
  // Keep the four-dot content crisp while the glass material becomes transparent.
  dotGroup: {
    flexDirection: 'row',
    gap: 5,
    left: 15,
    position: 'absolute',
    top: 18,
  },
  dot: { backgroundColor: '#ffffff', borderRadius: 2, height: 4, width: 4 },
  // The empty area in card-oval-space.png (right of the dots ≈ 44%–92% of width).
  digitsSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '44%',
    right: '8%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Figma 20095:5483 — 16px Mona Sans Medium.
  digits: { color: '#ffffff', fontSize: 16, fontWeight: '500', lineHeight: 18 },
});

export default CardGlyphBadge;
