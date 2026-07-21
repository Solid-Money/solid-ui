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
 * The glass glyph oval ("••••" + optional last-4 digits) on the bottom-left of
 * the VISA Platinum card, drawn in code (the baked-in oval was removed from the
 * artwork). Approximates the Figma "Glass" effect: a light backdrop blur (low
 * intensity, like Figma's Frost 3 — expo-blur is the closest RN primitive, as
 * refraction/dispersion have no RN equivalent) under a translucent #FFFFFF @ 20%
 * fill, so the card colour reads through as glass rather than an opaque white.
 */
const CardGlyphBadge = ({ last4, cardWidth }: CardGlyphBadgeProps) => {
  const scale = cardWidth && cardWidth > 0 ? cardWidth / REF_CARD_WIDTH : 1;
  const s = (n: number) => Math.round(n * scale * 100) / 100;

  const dot = s(5);
  const gap = s(6);

  return (
    <View style={styles.anchor} pointerEvents="none">
      <View style={[styles.pill, { paddingHorizontal: s(14), paddingVertical: s(11), gap }]}>
        {/* Light frost. experimentalBlurMethod gives real (subtle) blur on
            Android; low intensity keeps it glassy rather than opaque white. */}
        <BlurView
          intensity={12}
          tint="light"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        {/* Figma fill: #FFFFFF @ 20% — the translucent glass tint. */}
        <View style={styles.tint} pointerEvents="none" />
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
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});

export default CardGlyphBadge;
