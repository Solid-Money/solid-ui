import { StyleSheet, View } from 'react-native';

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
 * The glass glyph oval ("••••" + optional last-4 digits) on the bottom-left of
 * the VISA Platinum card, drawn in code (the baked-in oval was removed from the
 * artwork). Matches the Figma element: a translucent white pill (#FFFFFF @ 20%)
 * over the card — no backdrop blur, so the card colour reads through as glass
 * rather than an opaque white fill. Chunky 60×40-style padding around small dots.
 */
const CardGlyphBadge = ({ last4, cardWidth }: CardGlyphBadgeProps) => {
  const scale = cardWidth && cardWidth > 0 ? cardWidth / REF_CARD_WIDTH : 1;
  const s = (n: number) => Math.round(n * scale * 100) / 100;

  const dot = s(5);
  const gap = s(6);

  return (
    <View style={styles.anchor} pointerEvents="none">
      <View style={[styles.pill, { paddingHorizontal: s(14), paddingVertical: s(11), gap }]}>
        <View style={{ flexDirection: 'row', gap }}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: '#ffffff' }}
            />
          ))}
        </View>
        {last4 ? (
          <Text style={{ color: '#ffffff', fontSize: s(13), fontWeight: '600', lineHeight: s(15) }}>
            {last4}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Bottom-left of the card face. The artwork has ~5.6% shadow on the left and
  // ~10% on the bottom, so these insets keep the pill just inside the face.
  anchor: { position: 'absolute', left: '9%', bottom: '14%' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    // Figma fill: #FFFFFF @ 20% (translucent — the card shows through as glass).
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});

export default CardGlyphBadge;
