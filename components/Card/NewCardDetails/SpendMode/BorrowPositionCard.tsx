import { Pressable, StyleSheet } from 'react-native';

import {
  BorrowedSummary,
  type BorrowedSummaryFigures,
} from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';

interface BorrowPositionCardProps extends BorrowedSummaryFigures {
  onPress: () => void;
}

/**
 * The borrow position on the card screen (Figma 26134:23800): the same borrowed
 * block the spend-mode sheet shows, on the page's own card background and
 * pressable — it opens the position sheet, where the loan can be repaid.
 *
 * Rendering it at all is the caller's decision: the card screen gates on
 * `showsBorrowPosition`, which is a credit line worth naming rather than a loan
 * already drawn — an undrawn line still answers "what can I spend on this card",
 * which is the question someone on Credit opens the screen with.
 */
const BorrowPositionCard = ({ onPress, ...figures }: BorrowPositionCardProps) => (
  <Pressable
    accessibilityLabel="View borrow position"
    accessibilityRole="button"
    className="overflow-hidden rounded-[23px] bg-card transition-all active:scale-[0.98] active:opacity-80"
    onPress={onPress}
    style={styles.card}
  >
    <BorrowedSummary {...figures} />
  </Pressable>
);

const styles = StyleSheet.create({
  // Figma 385 × 123 — the block starts 3pt lower here than it does inside a sheet.
  card: { height: 123, paddingTop: 26 },
});

export default BorrowPositionCard;
