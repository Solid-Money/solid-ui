import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import SheetIconButton from '@/components/Card/NewCardDetails/SpendMode/SheetIconButton';

export const BLACK_FRIDAY_DRAWER_BACKGROUND = '#141415';
export const BLACK_FRIDAY_DRAWER_RADIUS = 32;

// The cards, backdrop, and fade are composited into one image for the sheet entrance.
const artwork = require('@/assets/images/black-friday/drawer/hero.webp');

export default function BlackFridayDrawerHero({
  onClose,
  showHandle,
}: {
  onClose: () => void;
  showHandle: boolean;
}) {
  return (
    <View style={styles.hero}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        <Image source={artwork} style={StyleSheet.absoluteFill} contentFit="fill" />
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
    aspectRatio: 419 / 240,
    backgroundColor: BLACK_FRIDAY_DRAWER_BACKGROUND,
    borderTopLeftRadius: BLACK_FRIDAY_DRAWER_RADIUS,
    borderTopRightRadius: BLACK_FRIDAY_DRAWER_RADIUS,
    overflow: 'hidden',
    width: '100%',
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
