import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { CardRevealValues } from '@/components/Card/NewCardDetails/cardRevealValues';
import CopyButton from '@/components/Card/NewCardDetails/CopyButton';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

/**
 * Figma's card body. The artwork — ovals and all — is scaled to whatever width the
 * card actually gets, so everything drawn over it has to be scaled by the same factor
 * rather than laid out in the design's points. Skipping that put the copy glyphs a
 * tenth of a card too far right on anything narrower than the artboard.
 */
const DESIGN_CARD_WIDTH = 383;

/** Design geometry of the ovals, in artboard points (Figma 21742:4089). */
const PILL = {
  height: 40,
  gap: 12,
  /** The value's inset from the oval's left edge. */
  paddingLeft: 15,
  /** The copy glyph's inset from the oval's right edge. */
  paddingRight: 18,
  fontSize: 16,
  lineHeight: 17.6,
  iconSize: 15.0251,
  width: { number: 261, expiry: 104, cvv: 93 },
};

interface PillProps {
  width: number;
  value: string;
  onCopy: () => void;
  accessibilityLabel: string;
  scale: number;
}

/**
 * The value and copy affordance sitting over one of the ovals in the artwork. The
 * oval itself isn't drawn here — it's part of card-flipped.png.
 */
const Pill = ({ width, value, onCopy, accessibilityLabel, scale }: PillProps) => (
  <View style={{ alignItems: 'center', flexDirection: 'row', height: PILL.height * scale, width }}>
    <Text
      numberOfLines={1}
      style={{
        color: '#ffffff',
        flex: 1,
        fontSize: PILL.fontSize * scale,
        fontWeight: '500',
        lineHeight: PILL.lineHeight * scale,
        marginLeft: PILL.paddingLeft * scale,
      }}
    >
      {value}
    </Text>
    <CopyButton
      accessibilityLabel={accessibilityLabel}
      onCopy={onCopy}
      size={PILL.iconSize * scale}
      style={{ marginRight: PILL.paddingRight * scale }}
    />
  </View>
);

interface CardRevealFaceProps {
  values: CardRevealValues;
  onCopyNumber: () => void;
  onCopyExpiry: () => void;
  onCopyCvv: () => void;
}

/**
 * The card's revealed face (Figma 21742:4089), drawn as the design's own artwork with
 * only the values and copy glyphs placed over it.
 *
 * The whole face is one export: the frosted band, the three empty glass ovals and —
 * importantly — a card with no VISA Platinum logo, which the front face has and this
 * one doesn't. It's laid over the front artwork rather than replacing it, so the card
 * keeps its drop shadow and both faces stay exactly the same size through the flip;
 * covering the body is what hides the logo.
 *
 * Positioned as a percentage of the card BODY. visa-platinum-card.png wraps that body
 * in a baked-in drop shadow, so `body` insets this overlay to the body's edges first —
 * then the design's own fractions apply directly.
 */
const CardRevealFace = ({ values, onCopyNumber, onCopyExpiry, onCopyCvv }: CardRevealFaceProps) => {
  // Measured rather than derived: the card's width comes out of the artwork's bleed
  // maths and the content column, so reading it back is the one thing guaranteed to
  // agree with the ovals in the image.
  const [bodyWidth, setBodyWidth] = useState(0);
  const scale = bodyWidth / DESIGN_CARD_WIDTH;

  const rowStyles = useMemo(
    () => ({
      number: { left: '5.22%', position: 'absolute', top: '50.01%' } as const,
      secondary: {
        flexDirection: 'row',
        gap: PILL.gap * scale,
        left: '5.22%',
        position: 'absolute',
        top: '73.93%',
      } as const,
    }),
    [scale],
  );

  const handleLayout = (event: LayoutChangeEvent) => setBodyWidth(event.nativeEvent.layout.width);

  return (
    <View pointerEvents="box-none" style={styles.body} onLayout={handleLayout}>
      <Image
        source={getAsset('images/card-flipped.png')}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        pointerEvents="none"
      />
      {/* Nothing to place until the card has been measured. It's built while the pane
          is idle and invisible, so this never shows as a missing frame. */}
      {bodyWidth > 0 && (
        <>
          <View pointerEvents="box-none" style={rowStyles.number}>
            <Pill
              width={PILL.width.number * scale}
              value={values.number}
              onCopy={onCopyNumber}
              accessibilityLabel="Copy card number"
              scale={scale}
            />
          </View>
          <View pointerEvents="box-none" style={rowStyles.secondary}>
            <Pill
              width={PILL.width.expiry * scale}
              value={values.expiry}
              onCopy={onCopyExpiry}
              accessibilityLabel="Copy expiry date"
              scale={scale}
            />
            <Pill
              width={PILL.width.cvv * scale}
              value={values.cvv}
              onCopy={onCopyCvv}
              accessibilityLabel="Copy security code"
              scale={scale}
            />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // The opaque card body inside the artwork's 861×555 box: 5.575% of the width on
  // each side, 7.387% of the height on top and 9.910% at the bottom.
  body: {
    bottom: '9.910%',
    left: '5.575%',
    position: 'absolute',
    right: '5.575%',
    top: '7.387%',
  },
});

export default CardRevealFace;
