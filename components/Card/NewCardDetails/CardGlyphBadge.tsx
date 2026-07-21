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

/**
 * Glass glyph oval on the bottom-left of the VISA Platinum card. Uses the
 * pre-rendered glass artwork so it gets a real frosted-glass look:
 *  - card-oval.png (60×40): "••••" only — while the last-4 is loading or the
 *    user has no card.
 *  - card-oval-space.png (107×40): "••••" + empty space, with the card's last 4
 *    digits positioned in that space.
 */
const CardGlyphBadge = ({ last4 }: CardGlyphBadgeProps) => {
  return (
    <View style={styles.anchor} pointerEvents="none">
      {last4 ? (
        <View style={styles.spaceOval}>
          <Image
            source={getAsset('images/card-oval-space.png')}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
          />
          <View style={styles.digitsSlot}>
            <Text style={styles.digits}>{last4}</Text>
          </View>
        </View>
      ) : (
        <Image
          source={getAsset('images/card-oval.png')}
          style={styles.dotsOval}
          contentFit="contain"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Bottom-left of the card face (the artwork has ~5.6% left / ~10% bottom shadow).
  anchor: { position: 'absolute', left: '9%', bottom: '14%' },
  dotsOval: { width: OVAL_WIDTH, height: OVAL_HEIGHT },
  spaceOval: { width: OVAL_SPACE_WIDTH, height: OVAL_HEIGHT },
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
  digits: { color: '#ffffff', fontSize: 14, fontWeight: '600', lineHeight: 16 },
});

export default CardGlyphBadge;
