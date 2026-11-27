import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';

import { Text } from '@/components/ui/text';

import type { SharedValue } from 'react-native-reanimated';

// The angular fills are rendered from Figma's gradient stops and transform so
// the same fills can be used on native and web. The other layers are Figma exports.
// Native loads raster copies of the shine SVGs to preserve their blur filters.
const bannerFill = require('@/assets/images/black-friday/banner-fill.png');
const closeIcon = require('@/assets/images/black-friday/dismiss.svg');
const texture = require('@/assets/images/black-friday/texture.png');
const goldCard = {
  fill: require('@/assets/images/black-friday/gold-fill.png'),
  pattern: require('@/assets/images/black-friday/gold-pattern.svg'),
  logo: require('@/assets/images/black-friday/gold-visa.svg'),
  shine: Platform.select({
    web: require('@/assets/images/black-friday/gold-shine.svg'),
    default: require('@/assets/images/black-friday/gold-shine.png'),
  }),
  textureOpacity: 0.15,
  edgeColor: 'rgba(255,255,255,0.4)',
  delay: 320,
};
const silverCard = {
  fill: require('@/assets/images/black-friday/silver-fill.png'),
  pattern: require('@/assets/images/black-friday/silver-pattern.svg'),
  logo: require('@/assets/images/black-friday/silver-visa.svg'),
  shine: Platform.select({
    web: require('@/assets/images/black-friday/silver-shine.svg'),
    default: require('@/assets/images/black-friday/silver-shine.png'),
  }),
  textureOpacity: 0.2,
  edgeColor: '#fff',
  delay: 200,
};

const BANNER_ANIMATION_MS = 2200;
const BANNER_WIDTH = 385;
const BANNER_RADIUS = 15.888;
const ARTWORK_WIDTH = 146;
const CARD_RADIUS = 5.995;
const CARD_ROTATION = -55.1175;
const TEXTURE_SIZE = 119.041;
const FADE_COLORS = ['rgba(116,107,74,0)', 'rgba(116,107,74,0.6)'] as const;
const easeOut = Easing.bezierFn(0, 0, 0.58, 1);
const easeInOut = Easing.bezierFn(0.42, 0, 0.58, 1);
const enter = Easing.bezierFn(0.22, 1, 0.36, 1);

function segment(time: number, start: number, duration: number) {
  'worklet';
  return Math.min(1, Math.max(0, (time - start) / duration));
}

const BannerTitle = ({
  children,
  time,
  offer = false,
  animate,
}: {
  children: string;
  time: SharedValue<number>;
  offer?: boolean;
  animate: boolean;
}) => {
  const style = useAnimatedStyle(() => {
    const delay = offer ? 100 : 0;
    return {
      opacity: easeOut(segment(time.value, delay, 400)),
      transform: [{ translateY: 6 * (1 - enter(segment(time.value, delay, 500))) }],
    };
  });

  return (
    <Animated.View style={[styles.titlePosition, offer && styles.offerPosition, animate && style]}>
      <Text
        className={offer ? 'font-extrabold text-[#DDD2A5]' : 'font-extrabold text-white'}
        maxFontSizeMultiplier={1.15}
        numberOfLines={1}
        style={styles.title}
      >
        {children}
      </Text>
    </Animated.View>
  );
};

const PromoCard = ({ time, gold = false }: { time: SharedValue<number>; gold?: boolean }) => {
  const { delay, fill, pattern, logo, shine, textureOpacity, edgeColor } = gold
    ? goldCard
    : silverCard;
  const cardMotion = useAnimatedStyle(() => {
    const offset = 1 - enter(segment(time.value, delay, 800));
    return {
      opacity: easeOut(segment(time.value, delay, 400)),
      transform: [
        { translateX: -10 * offset },
        { translateY: 18 * offset },
        { rotate: `${CARD_ROTATION + 2.5 * offset}deg` },
      ],
    };
  });
  const shineMotion = useAnimatedStyle(() => {
    const start = delay + 700;
    const firstFlash = easeInOut(segment(time.value, start, 400));
    const secondFlash = easeInOut(segment(time.value, start + 800, 250));
    return {
      // The exported shine already includes its resting 60% opacity.
      opacity: (firstFlash + secondFlash) / 2,
      transform: [{ translateX: -210 * (1 - easeInOut(segment(time.value, start, 1000))) }],
    };
  });

  return (
    <Animated.View style={[styles.card, gold && styles.goldCard, cardMotion]}>
      <View style={styles.cardClip}>
        <Image source={fill} style={StyleSheet.absoluteFill} contentFit="fill" />
        <View style={[styles.overlay, styles.pattern]}>
          <Image source={pattern} style={styles.patternImage} contentFit="fill" />
        </View>
        <View style={[styles.overlay, StyleSheet.absoluteFill, { opacity: textureOpacity }]}>
          <Image source={texture} style={[styles.texture, styles.textureTop]} contentFit="fill" />
          <Image
            source={texture}
            style={[styles.texture, styles.textureBottom]}
            contentFit="fill"
          />
        </View>
        <Image source={logo} style={styles.logo} contentFit="fill" />
        <Animated.View style={[styles.overlay, StyleSheet.absoluteFill, shineMotion]}>
          <Image source={shine} style={styles.shine} contentFit="fill" />
        </Animated.View>
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.cardEdge,
            { boxShadow: `inset 0.38px 0.38px 0.17px ${edgeColor}` },
          ]}
        />
      </View>
    </Animated.View>
  );
};

export default function BlackFridayBanner({
  onDismiss,
  onPress,
}: {
  onDismiss?: () => void;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const shouldAnimate = isFocused && !reduceMotion;
  const time = useSharedValue(shouldAnimate ? 0 : BANNER_ANIMATION_MS);
  const [width, setWidth] = useState(BANNER_WIDTH);
  const artworkScale = Math.min(1, Math.max(0.45, (width - 239) / ARTWORK_WIDTH));

  useEffect(() => {
    time.value = shouldAnimate ? 0 : BANNER_ANIMATION_MS;
    if (shouldAnimate) {
      time.value = withTiming(BANNER_ANIMATION_MS, {
        duration: BANNER_ANIMATION_MS,
        easing: Easing.linear,
      });
    }
    return () => cancelAnimation(time);
  }, [shouldAnimate, time]);

  const fade = useAnimatedStyle(() => ({ opacity: easeOut(segment(time.value, 200, 500)) }));

  return (
    <View style={styles.banner} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        <Image source={bannerFill} style={StyleSheet.absoluteFill} contentFit="fill" />
        <View style={[styles.artwork, { transform: [{ scale: artworkScale }] }]}>
          <PromoCard time={time} gold />
          <PromoCard time={time} />
          <Animated.View style={[styles.fade, fade]}>
            <LinearGradient colors={FADE_COLORS} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
        <View style={[StyleSheet.absoluteFill, styles.bannerEdge]} />
      </View>
      <Pressable
        accessibilityLabel="Black Friday. 30% off tiers!"
        accessibilityRole="button"
        onPress={() => {
          // Settle the banner before the drawer starts moving over it.
          time.value = BANNER_ANIMATION_MS;
          onPress();
        }}
        style={StyleSheet.absoluteFill}
      >
        <BannerTitle time={time} animate={!!onDismiss}>
          BLACK FRIDAY
        </BannerTitle>
        <BannerTitle time={time} animate={!!onDismiss} offer>
          30% OFF TIERS!
        </BannerTitle>
      </Pressable>
      {onDismiss && (
        <Pressable
          accessibilityLabel="Dismiss Black Friday promotion"
          accessibilityRole="button"
          onPress={onDismiss}
          style={styles.dismiss}
        >
          <Image
            accessible={false}
            source={closeIcon}
            style={styles.dismissIcon}
            contentFit="fill"
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    borderRadius: BANNER_RADIUS,
    height: 86,
    overflow: 'hidden',
  },
  bannerEdge: {
    borderRadius: BANNER_RADIUS,
    boxShadow: 'inset 1px 1px 0.45px -0.47px rgba(255,255,255,0.4)',
  },
  titlePosition: {
    left: 22,
    position: 'absolute',
    right: 42,
    top: 15,
  },
  offerPosition: {
    top: 39,
  },
  title: {
    fontFamily: 'MonaSans_800ExtraBold',
    fontSize: 22,
    lineHeight: 31,
  },
  dismiss: {
    alignItems: 'center',
    height: 44,
    paddingRight: 9,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 44,
  },
  dismissIcon: {
    height: 20,
    width: 20,
    alignSelf: 'flex-end',
  },
  artwork: {
    bottom: 0,
    position: 'absolute',
    right: 33,
    top: 0,
    transformOrigin: 'right bottom',
    width: ARTWORK_WIDTH,
  },
  card: {
    borderRadius: CARD_RADIUS,
    boxShadow: '5px 5px 16px rgba(0,0,0,0.1)',
    height: 64.898,
    left: 2.525,
    position: 'absolute',
    top: 37.433,
    width: 107.903,
  },
  goldCard: {
    left: 39.58,
    top: 36.366,
  },
  cardClip: {
    borderRadius: CARD_RADIUS,
    flex: 1,
    isolation: 'isolate',
    overflow: 'hidden',
  },
  cardEdge: {
    borderRadius: CARD_RADIUS,
  },
  overlay: {
    mixBlendMode: 'overlay',
  },
  pattern: {
    left: -10.69,
    position: 'absolute',
    top: -24.94,
  },
  patternImage: {
    height: 120.266,
    width: 123.59,
  },
  texture: {
    height: TEXTURE_SIZE,
    left: -3.605,
    position: 'absolute',
    transform: [{ rotate: '180deg' }],
    width: TEXTURE_SIZE,
  },
  textureTop: {
    top: -63.318,
  },
  textureBottom: {
    top: 55.723,
  },
  logo: {
    height: 11.37,
    left: 83.36,
    position: 'absolute',
    top: 48.925,
    transform: [{ rotate: '0.35deg' }, { skewX: '2.27deg' }],
    width: 19.749,
  },
  shine: {
    height: 240.281,
    left: 50.79,
    position: 'absolute',
    top: -107.09,
    transform: [{ rotate: '41.16deg' }],
    width: 74.546,
  },
  fade: {
    bottom: 0,
    height: 31,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
