import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { CardRevealValues } from '@/components/Card/NewCardDetails/cardRevealValues';
import { CopyIcon } from '@/components/Card/NewCardDetails/icons';
import { Text } from '@/components/ui/text';
import { AssetPath, getAsset } from '@/lib/assets';

/** Every pill on the card face is 40pt tall (Figma 21742:4089). */
const PILL_HEIGHT = 40;
/** Figma widths: the card number, the expiry and the security code. */
const PILL_WIDTH = { number: 261, expiry: 104, cvv: 93 };

interface PillProps {
  artwork: AssetPath;
  width: number;
  value: string;
  onCopy: () => void;
  accessibilityLabel: string;
}

/**
 * One glass oval on the revealed card face. The oval itself is artwork exported
 * from the Figma card (nodes 21742:4160 / 4240 / 4254), so it carries the design's
 * real frosted-glass material — including the backdrop blur — rather than an
 * approximation drawn in code. The value and the copy glyph sit on top.
 *
 * Same approach as the glyph badge on the card's front face, which draws its own
 * pre-rendered oval and positions the last 4 digits over it.
 */
const Pill = ({ artwork, width, value, onCopy, accessibilityLabel }: PillProps) => (
  <View style={[styles.pill, { width }]}>
    <Image
      source={getAsset(artwork)}
      style={StyleSheet.absoluteFill}
      contentFit="fill"
      pointerEvents="none"
    />
    <Text style={styles.value} numberOfLines={1}>
      {value}
    </Text>
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={12}
      onPress={onCopy}
      style={styles.copy}
      className="web:hover:opacity-70"
    >
      <CopyIcon />
    </Pressable>
  </View>
);

interface CardRevealFaceProps {
  values: CardRevealValues;
  onCopyNumber: () => void;
  onCopyExpiry: () => void;
  onCopyCvv: () => void;
}

/**
 * The revealed card face (Figma 21742:4089): the card number oval above an expiry +
 * security code row, over a translucent band across the artwork.
 *
 * Everything is positioned as a percentage of the card BODY. visa-platinum-card.png
 * wraps that body in a baked-in drop shadow, so `body` insets this overlay to the
 * body's edges first — then the design's own fractions apply directly.
 */
const CardRevealFace = ({ values, onCopyNumber, onCopyExpiry, onCopyCvv }: CardRevealFaceProps) => (
  <View pointerEvents="box-none" style={styles.body}>
    <View pointerEvents="none" style={styles.band} />
    <View pointerEvents="box-none" style={styles.numberRow}>
      <Pill
        artwork="images/card-pill-number.png"
        width={PILL_WIDTH.number}
        value={values.number}
        onCopy={onCopyNumber}
        accessibilityLabel="Copy card number"
      />
    </View>
    <View pointerEvents="box-none" style={styles.secondaryRow}>
      <Pill
        artwork="images/card-pill-expiry.png"
        width={PILL_WIDTH.expiry}
        value={values.expiry}
        onCopy={onCopyExpiry}
        accessibilityLabel="Copy expiry date"
      />
      <Pill
        artwork="images/card-pill-cvv.png"
        width={PILL_WIDTH.cvv}
        value={values.cvv}
        onCopy={onCopyCvv}
        accessibilityLabel="Copy security code"
      />
    </View>
  </View>
);

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
  // Figma 21742:4236 — a full-width rgba(0,0,0,0.2) band across 17.83%–40.01% of
  // the card body's height.
  band: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    height: '22.18%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: '17.83%',
  },
  numberRow: { left: '5.22%', position: 'absolute', top: '50.01%' },
  // Both ovals start at the same left edge as the number, 12pt apart.
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
    left: '5.22%',
    position: 'absolute',
    top: '73.93%',
  },
  pill: { alignItems: 'center', flexDirection: 'row', height: PILL_HEIGHT },
  // Figma insets the value 15 from the left and the copy glyph 18 from the right.
  value: {
    color: '#ffffff',
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 17.6,
    marginLeft: 15,
  },
  copy: { alignItems: 'center', justifyContent: 'center', marginRight: 18 },
});

export default CardRevealFace;
