import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { getAsset } from '@/lib/assets';

/** The disc the design draws, and the badge's own 63x30 ratio inside it. */
const DISC_SIZE = 50;
const BADGE_WIDTH = 36;
const BADGE_HEIGHT = 17;

/**
 * Google Pay mark on a dark disc — the Android counterpart of
 * {@link ApplePayCircle}, used on the home "Add to Google Wallet" banner.
 *
 * The design only draws the Apple state (Figma 25141:7283), so this reuses the
 * Google Pay badge the card benefits grid already ships (`badge-google-pay.svg`)
 * rather than redrawing the logo, and wraps it in the same 50pt `#2A2A2A` disc
 * the Apple mark sits on so the two banners are the same shape.
 *
 * A View + Image rather than an Svg because the badge is a multi-colour asset
 * from the registry, not a single-path glyph. `size` scales disc and badge
 * together, as `width`/`height` scale the Apple mark's viewBox.
 */
const GooglePayCircle = ({ size = DISC_SIZE }: { size?: number }) => {
  const scale = size / DISC_SIZE;
  return (
    <View style={[styles.disc, { borderRadius: size / 2, height: size, width: size }]}>
      <Image
        accessible={false}
        source={getAsset('images/badge-google-pay.svg')}
        contentFit="contain"
        style={{ height: BADGE_HEIGHT * scale, width: BADGE_WIDTH * scale }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Matches ApplePayCircle: a disc in the card's own lighter grey.
  disc: {
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
  },
});

export default GooglePayCircle;
