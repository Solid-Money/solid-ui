import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

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

interface TierSwitcherProps {
  tiers: readonly RewardsTier[];
  labels: Record<RewardsTier, string>;
  selected: RewardsTier;
  onSelect: (tier: RewardsTier) => void;
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
const TierSwitcher = ({ tiers, labels, selected, onSelect }: TierSwitcherProps) => {
  const tabWidth = (TRACK_WIDTH - TRACK_INSET * 2) / tiers.length;
  const selectedIndex = Math.max(tiers.indexOf(selected), 0);
  const pillX = useSharedValue(TRACK_INSET + selectedIndex * tabWidth);

  useEffect(() => {
    pillX.value = withTiming(TRACK_INSET + selectedIndex * tabWidth, PILL_TIMING);
  }, [pillX, selectedIndex, tabWidth]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  return (
    <View
      accessibilityRole="tablist"
      className="flex-row items-center self-center rounded-full"
      style={styles.track}
    >
      <Animated.View pointerEvents="none" style={[styles.pill, { width: tabWidth }, pillStyle]} />

      {tiers.map(tier => {
        const isSelected = tier === selected;

        return (
          <Pressable
            key={tier}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            className="items-center justify-center rounded-full transition-all active:opacity-70"
            onPress={() => onSelect(tier)}
            style={{ height: TAB_HEIGHT, width: tabWidth }}
          >
            <Text className={isSelected ? 'text-white' : 'text-white/60'} style={LABEL_STYLE}>
              {labels[tier]}
            </Text>
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
