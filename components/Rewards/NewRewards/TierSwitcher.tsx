import { type RefObject, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { EASE_OUT_QUINT } from '@/components/Card/NewCardDetails/heroMotion';
import { Text } from '@/components/ui/text';
import { RewardsTier } from '@/lib/types';

/** Slightly tightened from the 264px Figma track to better fit the mobile header. */
const TRACK_WIDTH = 252;
const TRACK_HEIGHT = 34;
const TRACK_INSET = 3;
const TAB_HEIGHT = TRACK_HEIGHT - TRACK_INSET * 2;

const TRACK_COLOR = '#2A2A2A';
const PILL_COLOR = '#0F0F10';
const PILL_BORDER_COLOR = 'rgba(255, 255, 255, 0.14)';

const PILL_TIMING = { duration: 240, easing: EASE_OUT_QUINT };

const LABEL_STYLE = { fontFamily: 'MonaSans_500Medium', fontSize: 14, lineHeight: 17 } as const;
const AnimatedLabel = Animated.createAnimatedComponent(Text);

function TierLabel({
  label,
  index,
  selected,
  light,
  progress,
  pageWidth,
  scale,
}: {
  label: string;
  index: number;
  selected: boolean;
  light: boolean;
  progress?: SharedValue<number>;
  pageWidth?: number;
  scale: number;
}) {
  const color = useAnimatedStyle(() => ({
    color:
      light && progress && pageWidth
        ? interpolateColor(
            Math.min(1, Math.abs(-progress.value / pageWidth - index)),
            [0, 1],
            ['#0F0F11', 'rgba(255,255,255,0.6)'],
          )
        : selected
          ? light
            ? '#0F0F11'
            : '#FFFFFF'
          : 'rgba(255,255,255,0.6)',
  }));
  return (
    <AnimatedLabel style={[LABEL_STYLE, { fontSize: 14 * scale, lineHeight: 17 * scale }, color]}>
      {label}
    </AnimatedLabel>
  );
}

interface TierSwitcherProps {
  tiers: readonly RewardsTier[];
  labels: Record<RewardsTier, string>;
  selected: RewardsTier;
  onSelect: (tier: RewardsTier) => void;
  appearance?: 'dark' | 'light';
  progress?: SharedValue<number>;
  pageWidth?: number;
  scale?: number;
  blurTarget?: RefObject<View | null>;
}

/**
 * Tier tabs: a grey track with a dark pill that slides onto whichever tab is
 * selected (Figma 20609:5949).
 *
 * The tabs are equal slices of a fixed-width track, so the pill's position is
 * arithmetic rather than measured. The measured version it replaces had to wait for
 * `onLayout` before it could place the pill, and its offsets were relative to the
 * track's padding box while the pill's were not — which is what left the pill sitting
 * beside the selected tab instead of under it.
 */
const TierSwitcher = ({
  tiers,
  labels,
  selected,
  onSelect,
  appearance = 'dark',
  progress,
  pageWidth,
  scale = 1,
  blurTarget,
}: TierSwitcherProps) => {
  const light = appearance === 'light';
  const reduceMotion = useReducedMotion();
  const trackWidth = (light ? 248 : TRACK_WIDTH) * scale;
  const trackHeight = (light ? 33 : TRACK_HEIGHT) * scale;
  const tabHeight = (light ? 25 : TAB_HEIGHT) * scale;
  const inset = (trackHeight - tabHeight) / 2;
  const tabWidth = (trackWidth - inset * 2) / tiers.length;
  const pillWidth = tabWidth;
  const selectedIndex = Math.max(tiers.indexOf(selected), 0);
  const pillX = useSharedValue(inset + selectedIndex * tabWidth + (tabWidth - pillWidth) / 2);

  useEffect(() => {
    const x = inset + selectedIndex * tabWidth + (tabWidth - pillWidth) / 2;
    pillX.value = reduceMotion ? x : withTiming(x, PILL_TIMING);
  }, [inset, pillWidth, pillX, reduceMotion, selectedIndex, tabWidth]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          progress && pageWidth && !reduceMotion
            ? inset +
              Math.max(0, Math.min(tiers.length - 1, -progress.value / pageWidth)) * tabWidth +
              (tabWidth - pillWidth) / 2
            : pillX.value,
      },
    ],
  }));

  return (
    <View
      accessibilityRole="tablist"
      className="flex-row items-center self-center rounded-full"
      style={[
        styles.track,
        {
          width: trackWidth,
          height: trackHeight,
          paddingHorizontal: inset,
          backgroundColor: light ? 'rgba(255,255,255,0.08)' : TRACK_COLOR,
          overflow: light ? 'hidden' : 'visible',
        },
      ]}
    >
      {light && (
        <BlurView
          {...(Platform.OS === 'android'
            ? { blurTarget, blurMethod: 'dimezisBlurView' as const, blurReductionFactor: 2.4 }
            : {})}
          intensity={55}
          tint="systemUltraThinMaterialDark"
          pointerEvents="none"
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pill,
          {
            width: pillWidth,
            height: tabHeight,
            top: (trackHeight - tabHeight) / 2,
            borderRadius: 100,
            backgroundColor: light ? '#FFFFFF' : PILL_COLOR,
            borderWidth: light ? 0 : StyleSheet.hairlineWidth,
          },
          pillStyle,
        ]}
      />

      {tiers.map((tier, index) => {
        const isSelected = tier === selected;

        return (
          <Pressable
            key={tier}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            aria-selected={isSelected}
            className="items-center justify-center rounded-full transition-all active:opacity-70"
            onPress={() => onSelect(tier)}
            style={{ height: tabHeight, width: tabWidth }}
            hitSlop={{ top: 10, bottom: 10 }}
          >
            <TierLabel
              label={labels[tier]}
              index={index}
              selected={isSelected}
              light={light}
              progress={progress}
              pageWidth={pageWidth}
              scale={scale}
            />
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    backgroundColor: TRACK_COLOR,
    height: TRACK_HEIGHT,
    paddingHorizontal: TRACK_INSET,
    width: TRACK_WIDTH,
  },
  // left-0 rather than the static position, so translateX is measured from the
  // track's own origin.
  pill: {
    backgroundColor: PILL_COLOR,
    borderColor: PILL_BORDER_COLOR,
    borderRadius: TAB_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    height: TAB_HEIGHT,
    left: 0,
    position: 'absolute',
    top: TRACK_INSET,
  },
});

export default TierSwitcher;
