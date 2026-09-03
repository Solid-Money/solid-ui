import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { getAsset } from '@/lib/assets';

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
 * from the registry, not a single-path glyph.
 */
const GooglePayCircle = () => (
  <View style={styles.disc}>
    <Image
      accessible={false}
      source={getAsset('images/badge-google-pay.svg')}
      contentFit="contain"
      style={styles.badge}
    />
  </View>
);

const styles = StyleSheet.create({
  // Matches ApplePayCircle: a 50pt disc in the card's own lighter grey.
  disc: {
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  // The badge's own 63x30 ratio, scaled to leave the disc a margin on each side.
  badge: { height: 17, width: 36 },
});

export default GooglePayCircle;
