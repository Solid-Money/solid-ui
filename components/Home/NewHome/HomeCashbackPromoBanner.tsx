import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/text';

const cashbackArtwork = require('@/assets/images/home-cashback-promo-10.png');
const cashbackGlow = require('@/assets/images/home-cashback-promo-glow.svg');

/**
 * The compact new-app cashback promotion from Figma 22024:1057.
 *
 * Artwork stays pinned to the right at its original size so the 387px mobile
 * layout is pixel-for-pixel while wider home columns gain breathing room rather
 * than stretching the type and image.
 */
const HomeCashbackPromoBanner = () => (
  <View style={styles.card}>
    <Image
      accessible={false}
      source={cashbackGlow}
      contentFit="fill"
      pointerEvents="none"
      style={styles.glow}
    />

    <Text style={styles.title}>10% Cashback for 7 Days!</Text>
    <Text style={styles.description}>Celebrate our new mobile app with 10% cashback all week</Text>

    <Image
      accessible={false}
      source={cashbackArtwork}
      contentFit="cover"
      pointerEvents="none"
      style={styles.artwork}
    />

    <View pointerEvents="none" style={styles.beamStage}>
      <LinearGradient
        colors={['rgba(148,242,127,0)', 'rgba(148,242,127,0.1)']}
        style={styles.beam}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1C',
    borderRadius: 23,
    height: 98,
    overflow: 'hidden',
    position: 'relative',
  },
  glow: {
    height: 287,
    position: 'absolute',
    right: -87,
    top: -6,
    width: 287,
  },
  title: {
    fontFamily: 'MonaSans_700Bold',
    fontSize: 18,
    left: 21,
    lineHeight: 25,
    position: 'absolute',
    top: 18,
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'MonaSans_400Regular',
    fontSize: 14,
    left: 21,
    lineHeight: 16,
    position: 'absolute',
    top: 48,
    width: 211,
  },
  artwork: {
    height: 177,
    position: 'absolute',
    right: -12,
    top: 9,
    width: 152,
  },
  beamStage: {
    alignItems: 'center',
    height: 71.222,
    justifyContent: 'center',
    position: 'absolute',
    right: -12.154,
    top: 62,
    width: 299.198,
  },
  beam: {
    height: 34,
    transform: [{ rotate: '-7.25deg' }],
    width: 297.284,
  },
});

export default HomeCashbackPromoBanner;
