import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { Text } from '@/components/ui/text';

// Reference width (px) of the rendered card image used to scale the badge, so it
// keeps the same proportions whether the card is shown small on home or larger
// on the details screen.
const REF_CARD_WIDTH = 340;

interface CardGlyphBadgeProps {
  /** Last 4 digits of the card, appended after the dots (omitted when unknown). */
  last4?: string;
  /** Measured width of the parent card image; drives proportional sizing. */
  cardWidth?: number;
}

/**
 * The frosted-glass oval ("••••" glyph + optional last-4 digits) shown on the
 * bottom-left of the VISA Platinum card. Drawn in code (the baked-in oval was
 * removed from the artwork) to mirror the Figma "Glass" style: a white-tinted
 * blurred pill with a hairline highlight. Positioned over the card face —
 * insets are proportional so it lands in the same spot at any render width.
 */
const CardGlyphBadge = ({ last4, cardWidth }: CardGlyphBadgeProps) => {
  const scale = cardWidth && cardWidth > 0 ? cardWidth / REF_CARD_WIDTH : 1;
  const s = (n: number) => Math.round(n * scale * 100) / 100;

  const dot = s(5);
  const gap = s(4);

  return (
    <View style={styles.anchor} pointerEvents="none">
      <View style={[styles.pill, { borderRadius: 999 }]}>
        <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[styles.content, { paddingHorizontal: s(10), paddingVertical: s(6), gap }]}>
          <View style={{ flexDirection: 'row', gap }}>
            {[0, 1, 2, 3].map(i => (
              <View
                key={i}
                style={{
                  width: dot,
                  height: dot,
                  borderRadius: dot / 2,
                  backgroundColor: '#ffffff',
                }}
              />
            ))}
          </View>
          {last4 ? (
            <Text
              style={{ color: '#ffffff', fontSize: s(13), fontWeight: '600', lineHeight: s(15) }}
            >
              {last4}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Bottom-left of the card face. The artwork has ~5.6% shadow on the left and
  // ~10% on the bottom, so these insets keep the pill just inside the face.
  anchor: { position: 'absolute', left: '9%', bottom: '14%' },
  pill: { overflow: 'hidden' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});

export default CardGlyphBadge;
