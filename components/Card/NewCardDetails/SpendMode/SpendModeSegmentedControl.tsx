import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { EASE_OUT_EXPO } from '@/components/Card/NewCardDetails/heroMotion';
import {
  SPEND_MODE_COPY,
  SPEND_MODES,
  type SpendMode,
} from '@/components/Card/NewCardDetails/SpendMode/spendModes';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * Panel geometry, measured off the Figma control (25961:3490, 385 × 73 on the
 * 419pt artboard). The pill sits 3pt inside the track on every edge, which is
 * what gives it its 67pt height.
 */
const CONTROL_HEIGHT = 73;
const CONTROL_INSET = 3;
/** How long the pill takes to reach the segment that was tapped. */
const SLIDE_DURATION = 340;

interface SegmentLabelsProps {
  mode: SpendMode;
  /** The figure under the name, read from the chain rather than from copy. */
  value: string;
  /** Dark is the copy that shows through the white pill. */
  tone: 'light' | 'dark';
}

/** "Cash / Add USDC", stacked and centred — the same block in both tones. */
const SegmentLabels = ({ mode, value, tone }: SegmentLabelsProps) => (
  <View style={styles.labels}>
    <Text
      className={cn(
        'text-[18px] font-semibold leading-[25px]',
        tone === 'dark' ? 'text-black' : 'text-white',
      )}
    >
      {SPEND_MODE_COPY[mode].label}
    </Text>
    <Text
      className={cn(
        'text-[14px] font-normal leading-[14px]',
        tone === 'dark' ? 'text-black/70' : 'text-white/70',
      )}
    >
      {value}
    </Text>
  </View>
);

interface SpendModeSegmentedControlProps {
  /**
   * The segment the sheet is currently showing. The white pill sits on it whether or
   * not it is the mode in force — the button under the panels already says which one
   * that is ("Cancel" on it, "Change to …" anywhere else), and a translucent pill on a
   * mode being considered read as a control that had not taken the tap.
   */
  selected: SpendMode;
  /** The figure under each segment name. */
  segmentValue: Record<SpendMode, string>;
  onSelect: (mode: SpendMode) => void;
  /**
   * Ignores taps. Set while a mode change is being signed: the commit captured the
   * mode as it was at the press, so letting the selection move underneath it would
   * leave the sheet describing one mode while another is on its way on-chain.
   *
   * No dimming of its own — the pill still shows what is being confirmed, and greying
   * the control would hide the one thing worth looking at while waiting.
   */
  disabled?: boolean;
}

/**
 * The three-way spend-mode switch (Figma 25961:3490).
 *
 * Figma draws the pill 140pt wide under "Cash" and 122pt under the other two,
 * because each one was sized to its own caption on a 385pt artboard. Here the
 * segments are even thirds of whatever width the sheet gets: the control has to
 * hold its proportions from a narrow phone to the desktop modal, and hand-fitting
 * the pill to the text would either overflow or leave a gap at every other size.
 */
const SpendModeSegmentedControl = ({
  selected,
  segmentValue,
  onSelect,
  disabled = false,
}: SpendModeSegmentedControlProps) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = trackWidth > 0 ? (trackWidth - CONTROL_INSET * 2) / SPEND_MODES.length : 0;

  const selectedIndex = SPEND_MODES.indexOf(selected);

  // 0 → 2 as the pill travels. Its position and the label tones all read from this
  // one value, so the dark copy can never arrive out of step with the pill.
  const position = useSharedValue(selectedIndex);

  useEffect(() => {
    position.value = withTiming(selectedIndex, {
      duration: SLIDE_DURATION,
      easing: EASE_OUT_EXPO,
    });
  }, [position, selectedIndex]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width),
    [],
  );

  const pillStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: position.value * segmentWidth }],
  }));

  return (
    <View onLayout={handleLayout} style={styles.track}>
      <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} />
      {SPEND_MODES.map((mode, index) => (
        <Segment
          key={mode}
          mode={mode}
          value={segmentValue[mode]}
          index={index}
          position={position}
          onSelect={onSelect}
          disabled={disabled}
        />
      ))}
    </View>
  );
};

interface SegmentProps {
  mode: SpendMode;
  value: string;
  index: number;
  position: ReturnType<typeof useSharedValue<number>>;
  onSelect: (mode: SpendMode) => void;
  disabled: boolean;
}

/**
 * One third of the control. The dark copy is a second, stacked layer rather than
 * an animated text colour: it fades up exactly as the white pill arrives, so the
 * label flips with the background instead of a step behind it — including on the
 * segments the pill only passes over on its way.
 */
const Segment = ({ mode, value, index, position, onSelect, disabled }: SegmentProps) => {
  const darkStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - Math.abs(position.value - index)),
  }));

  return (
    <Pressable
      accessibilityLabel={`${SPEND_MODE_COPY[mode].label} spend mode`}
      accessibilityRole="tab"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onSelect(mode)}
      style={styles.segment}
    >
      <SegmentLabels mode={mode} value={value} tone="light" />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, darkStyle]}>
        <SegmentLabels mode={mode} value={value} tone="dark" />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#2B2B2B',
    borderRadius: 200,
    flexDirection: 'row',
    height: CONTROL_HEIGHT,
    overflow: 'hidden',
    padding: CONTROL_INSET,
  },
  pill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 200,
    bottom: CONTROL_INSET,
    left: CONTROL_INSET,
    position: 'absolute',
    top: CONTROL_INSET,
  },
  segment: { flex: 1, justifyContent: 'center' },
  // 25pt name over a 14pt figure with 5 between, which is Figma's 13 / 43 pair
  // once the block is centred in the 67pt pill.
  labels: { alignItems: 'center', flex: 1, gap: 5, justifyContent: 'center' },
});

export default SpendModeSegmentedControl;
