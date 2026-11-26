import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import SheetIconButton from '@/components/Card/NewCardDetails/SpendMode/SheetIconButton';

export const BLACK_FRIDAY_DRAWER_BACKGROUND = '#141415';
export const BLACK_FRIDAY_DRAWER_RADIUS = 32;

const WIDTH = 419;
const HEIGHT = 240;
const TILE_SIZE = 261.89;
const backdrop = require('@/assets/images/black-friday/banner-fill.png');
const light = require('@/assets/images/black-friday/drawer/light.svg');
const texture = require('@/assets/images/black-friday/texture.png');
const fadeColors = [
  'rgba(20,20,21,0)',
  'rgba(20,20,21,0.55)',
  BLACK_FRIDAY_DRAWER_BACKGROUND,
] as const;

const ultra = {
  fill: require('@/assets/images/black-friday/gold-fill.png'),
  pattern: require('@/assets/images/black-friday/drawer/gold-pattern.svg'),
  logo: require('@/assets/images/black-friday/drawer/gold-visa.svg'),
  // The raster copy preserves the SVG's blur on native.
  shine: Platform.select({
    web: require('@/assets/images/black-friday/drawer/gold-shine.svg'),
    default: require('@/assets/images/black-friday/drawer/gold-shine.png'),
  }),
  left: 117.456,
  top: 108.832,
  textureOpacity: 0.15,
};
const prime = {
  fill: require('@/assets/images/black-friday/silver-fill.png'),
  pattern: require('@/assets/images/black-friday/drawer/silver-pattern.svg'),
  logo: require('@/assets/images/black-friday/drawer/silver-visa.svg'),
  shine: Platform.select({
    web: require('@/assets/images/black-friday/drawer/silver-shine.svg'),
    default: require('@/assets/images/black-friday/drawer/silver-shine.png'),
  }),
  left: 19.986,
  top: 106.512,
  textureOpacity: 0.2,
};

const textureTiles = [
  { left: -7.928, top: -139.302 },
  { left: 253.962, top: -139.302 },
  { left: -7.928, top: 122.588 },
  { left: 253.962, top: 122.588 },
];

const CardArtwork = ({ card }: { card: typeof ultra }) => (
  <View style={[styles.card, { left: card.left, top: card.top }]}>
    <View style={styles.cardFace}>
      <Image source={card.fill} style={StyleSheet.absoluteFill} contentFit="fill" />
      <View style={[styles.overlay, styles.pattern]}>
        <Image source={card.pattern} style={styles.patternImage} contentFit="fill" />
      </View>
      <View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: card.textureOpacity }]}>
        {textureTiles.map(tile => (
          <Image
            key={`${tile.left}-${tile.top}`}
            source={texture}
            style={[styles.texture, tile]}
            contentFit="fill"
          />
        ))}
      </View>
      <Image source={card.logo} style={styles.logo} contentFit="fill" />
      <View style={[StyleSheet.absoluteFill, styles.overlay]}>
        <Image source={card.shine} style={styles.shine} contentFit="fill" />
      </View>
    </View>
  </View>
);

export default function BlackFridayDrawerHero({
  onClose,
  showHandle,
}: {
  onClose: () => void;
  showHandle: boolean;
}) {
  const [width, setWidth] = useState(WIDTH);
  return (
    <View style={styles.hero} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        <Image source={backdrop} style={StyleSheet.absoluteFill} contentFit="fill" />
        <View style={[styles.artwork, { transform: [{ scale: width / WIDTH }] }]}>
          <Image source={light} style={styles.light} contentFit="fill" />
          <CardArtwork card={ultra} />
          <CardArtwork card={prime} />
        </View>
        <LinearGradient colors={fadeColors} locations={[0, 0.55, 1]} style={styles.fade} />
        {showHandle && <View style={styles.handle} />}
      </View>
      <SheetIconButton
        icon="close"
        accessibilityLabel="Close Black Friday offers"
        onPress={onClose}
        style={styles.closeButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    aspectRatio: WIDTH / HEIGHT,
    borderTopLeftRadius: BLACK_FRIDAY_DRAWER_RADIUS,
    borderTopRightRadius: BLACK_FRIDAY_DRAWER_RADIUS,
    overflow: 'hidden',
    width: '100%',
  },
  artwork: {
    height: HEIGHT,
    left: '50%',
    marginLeft: -WIDTH / 2,
    position: 'absolute',
    top: 0,
    transformOrigin: 'center top',
    width: WIDTH,
  },
  light: {
    height: 300,
    left: -100,
    position: 'absolute',
    top: -180,
    width: 460,
  },
  card: {
    borderRadius: 15.302,
    boxShadow: '-9.282px 11.603px 30.167px rgba(0,0,0,0.32)',
    height: 165.656,
    position: 'absolute',
    transform: [{ rotate: '-55.12deg' }],
    width: 275.429,
  },
  cardFace: {
    borderRadius: 15.302,
    flex: 1,
    isolation: 'isolate',
    overflow: 'hidden',
  },
  overlay: {
    mixBlendMode: 'overlay',
  },
  pattern: {
    left: -27.277,
    position: 'absolute',
    top: -63.673,
  },
  patternImage: {
    height: 306.986,
    width: 315.471,
  },
  texture: {
    height: TILE_SIZE,
    position: 'absolute',
    transform: [{ rotate: '180deg' }],
    width: TILE_SIZE,
  },
  logo: {
    height: 29.02,
    left: 213.79,
    position: 'absolute',
    top: 124.68,
    transform: [{ rotate: '0.35deg' }, { skewX: '2.27deg' }],
    width: 50.41,
  },
  shine: {
    height: 613.332,
    left: 129.649,
    position: 'absolute',
    top: -273.345,
    transform: [{ rotate: '41.16deg' }],
    width: 190.282,
  },
  fade: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: '50%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 3,
    height: 5,
    position: 'absolute',
    top: 10,
    width: 40,
  },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    position: 'absolute',
    right: 16,
    top: 16,
  },
});
