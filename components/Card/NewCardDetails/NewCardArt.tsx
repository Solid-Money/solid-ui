import { ReactNode, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import CardGlyphBadge from '@/components/Card/NewCardDetails/CardGlyphBadge';
import { getAsset } from '@/lib/assets';

// Intrinsic size of the (glyph-removed) VISA Platinum artwork, including its
// baked-in drop shadow, so it renders full-width without distortion.
export const NEW_CARD_ASPECT_RATIO = 861 / 555;

interface NewCardArtProps {
  /** Last 4 digits shown on the glyph badge (front only). */
  last4?: string;
  /**
   * Optional overlay rendered instead of the glyph badge — used for the flipped
   * "reveal" face (card number / expiry / CVV). When omitted, the glyph badge is
   * shown (the normal front face).
   */
  overlay?: ReactNode;
}

/**
 * The redesigned VISA Platinum card visual: the green artwork with the frosted
 * glass glyph oval drawn on top in code. Shared by the home wallet card, the
 * card-details screen, and the hero-transition clone so the card looks identical
 * everywhere (which is what makes the shared-element transition read as one card).
 */
const NewCardArt = ({ last4, overlay }: NewCardArtProps) => {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== width) setWidth(w);
  };

  return (
    <View onLayout={onLayout} style={styles.box}>
      <Image
        source={getAsset('images/visa-platinum-card.png')}
        alt="Solid VISA Platinum card"
        style={StyleSheet.absoluteFill}
        contentFit="contain"
      />
      {overlay ?? <CardGlyphBadge last4={last4} cardWidth={width} />}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { width: '100%', aspectRatio: NEW_CARD_ASPECT_RATIO },
});

export default NewCardArt;
