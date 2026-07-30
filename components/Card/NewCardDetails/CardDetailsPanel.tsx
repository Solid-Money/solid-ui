import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CardRevealValues } from '@/components/Card/NewCardDetails/cardRevealValues';
import { EASE_OUT_EXPO } from '@/components/Card/NewCardDetails/heroMotion';
import { CopyIcon, EyeIcon, EyeOffIcon } from '@/components/Card/NewCardDetails/icons';
import { Text } from '@/components/ui/text';

/**
 * Panel geometry, measured off the Figma frames (419pt-wide artboard):
 *
 *   collapsed (20095:5545)  387 × 154 — just the "Show details" strip
 *   expanded  (21742:4078)  387 × 286 — two copyable rows, a rule, "Hide details"
 *
 * The card covers the panel's top 71pt and the first content row starts at 100pt;
 * both scale with the screen, so they're fractions of its width. Everything below
 * the first row is fixed-height type, hence the two constants.
 */
const CARD_COVER_FRACTION = 71 / 419;
const CONTENT_TOP_FRACTION = 100 / 419;
const COLLAPSED_CONTENT = 54;
const EXPANDED_CONTENT = 186;
/** Content-top → the expanded "Hide details" row (Figma 243 − 100). */
const TOGGLE_OFFSET = 143;
const TOGGLE_HEIGHT = 24;

/** The panel expansion and the card flip run on this timing. */
export const REVEAL_DURATION = 420;

interface DetailRowProps {
  label: string;
  value: string;
  onCopy: () => void;
}

/** "Name on card / JOHN DOE" with a half-strength copy button on the right. */
const DetailRow = ({ label, value, onCopy }: DetailRowProps) => (
  <View style={styles.detailRow}>
    <View style={styles.detailText}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
    <Pressable
      accessibilityLabel={`Copy ${label.toLowerCase()}`}
      accessibilityRole="button"
      hitSlop={14}
      onPress={onCopy}
      style={styles.detailCopy}
    >
      <CopyIcon />
    </Pressable>
  </View>
);

interface CardDetailsPanelProps {
  /** True once the details are revealed — the panel is expanded in this state. */
  isRevealed: boolean;
  /** The reveal request is in flight; the toggle shows a spinner. */
  isLoading: boolean;
  onToggle: () => void;
  values: CardRevealValues;
  onCopyName: () => void;
  onCopyCountry: () => void;
}

/**
 * The panel behind the card. Collapsed it's the "Show details" strip peeking out
 * below the card; tapping it slides the panel down to expose the name and issuing
 * country rows and the "Hide details" toggle, in step with the card flipping over.
 */
const CardDetailsPanel = ({
  isRevealed,
  isLoading,
  onToggle,
  values,
  onCopyName,
  onCopyCountry,
}: CardDetailsPanelProps) => {
  const { width } = useWindowDimensions();
  const cardCover = width * CARD_COVER_FRACTION;
  const contentTop = width * CONTENT_TOP_FRACTION;
  const collapsedHeight = contentTop + COLLAPSED_CONTENT;
  const expandedHeight = contentTop + EXPANDED_CONTENT;

  // 0 → 1 as the panel opens. The height, the toggle's position and the detail
  // rows' fade all read from it, so they stay locked together.
  const progress = useSharedValue(isRevealed ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isRevealed ? 1 : 0, {
      duration: REVEAL_DURATION,
      easing: EASE_OUT_EXPO,
    });
  }, [isRevealed, progress]);

  const panelStyle = useAnimatedStyle(() => ({
    height: collapsedHeight + progress.value * (expandedHeight - collapsedHeight),
  }));

  const detailsStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (progress.value - 1) * 12 }],
  }));

  // Collapsed, the toggle fills the whole strip below the card so the tap target is
  // the full panel; expanded, it shrinks to its own row under the rule. Its content
  // is centred either way, which is where Figma puts the label in both states.
  const toggleStyle = useAnimatedStyle(() => {
    const collapsedTop = cardCover;
    const expandedTop = contentTop + TOGGLE_OFFSET;
    return {
      top: collapsedTop + progress.value * (expandedTop - collapsedTop),
      height:
        collapsedHeight -
        cardCover +
        progress.value * (TOGGLE_HEIGHT - (collapsedHeight - cardCover)),
    };
  });

  return (
    <Animated.View style={[styles.panel, panelStyle]} className="bg-card">
      {/* Absolutely positioned so the rows don't shove the toggle around while the
          panel is still growing. */}
      <Animated.View
        pointerEvents={isRevealed ? 'box-none' : 'none'}
        style={[styles.details, { top: contentTop }, detailsStyle]}
      >
        <DetailRow label="Name on card" value={values.nameOnCard} onCopy={onCopyName} />
        <View style={styles.detailGap} />
        <DetailRow label="Issuing country" value={values.issuingCountry} onCopy={onCopyCountry} />
        <View style={styles.divider} />
      </Animated.View>
      <AnimatedPressable
        accessibilityLabel={isRevealed ? 'Hide card details' : 'Show card details'}
        accessibilityRole="button"
        disabled={isLoading}
        onPress={onToggle}
        style={[styles.toggle, toggleStyle]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : isRevealed ? (
          <EyeOffIcon />
        ) : (
          <EyeIcon />
        )}
        <Text style={styles.toggleLabel}>{isRevealed ? 'Hide details' : 'Show details'}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  // Percentages resolve against the screen width, keeping the design's proportions
  // at any size: 21/419 wider than the card body on each side, pulled 71/419 up so
  // the top edge and its radius hide behind the card.
  panel: {
    borderRadius: 23,
    marginHorizontal: '5%',
    marginTop: '-16.95%',
    overflow: 'hidden',
  },
  details: { left: 0, position: 'absolute', right: 0 },
  detailRow: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: 21 },
  detailText: { flex: 1, gap: 1.6 },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  detailValue: { color: '#ffffff', fontSize: 16, fontWeight: '500', lineHeight: 23 },
  // Figma keeps the copy glyph at half strength inside the panel.
  detailCopy: { opacity: 0.5 },
  // 14.4pt between the two rows (Figma 144.6 → 159).
  detailGap: { height: 14.4 },
  // 23.4 below "Singapore", 15 above the toggle row.
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    height: 1,
    marginBottom: 15,
    marginTop: 23.4,
  },
  toggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  toggleLabel: { color: '#ffffff', fontSize: 16, fontWeight: '500', lineHeight: 23 },
});

export default CardDetailsPanel;
