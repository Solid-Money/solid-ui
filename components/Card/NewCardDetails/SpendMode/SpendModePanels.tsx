import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

/**
 * The cards the spend-mode surfaces are built from.
 *
 * Presentation only: every figure arrives as a prop from `useSpendModeFigures`, so the
 * same block shows the same number wherever it is placed.
 */

interface BalancePanelProps {
  balance: string;
  onAddFunds?: () => void;
}

/** "Your USDC balance / $0.0" with the Add funds pill on the right. */
export const SpendModeBalancePanel = ({ balance, onAddFunds }: BalancePanelProps) => (
  <View style={[styles.panel, styles.balancePanel]}>
    <View style={styles.balanceText}>
      <Text className="text-[16px] font-normal leading-[16px] text-white/70">
        Your USDC balance
      </Text>
      <Text className="text-[24px] font-medium leading-[24px] text-white">{balance}</Text>
    </View>
    <Pressable
      accessibilityLabel="Add funds"
      accessibilityRole="button"
      className="transition-all active:scale-95 active:opacity-80"
      onPress={onAddFunds}
      style={styles.addFunds}
    >
      <Text className="text-[16px] font-semibold text-black">Add funds</Text>
    </Pressable>
  </View>
);

/**
 * "Borrowed / $0.80 / $246.5 … at 5.57% APY" over the drawn-down track — the
 * block three surfaces share: the spend-mode sheet's Credit and Smart panels,
 * the borrow-position card on the card screen, and that card's own sheet.
 *
 * It draws no box of its own. Each of those three sits it on a different
 * background at a different inset, and the only thing that moves between them is
 * where the block starts, so the container owns the padding and this owns the
 * 35 / 15 rhythm inside it.
 */
export type BorrowedSummaryFigures = Pick<
  SpendModeFigures,
  'borrowed' | 'creditLimit' | 'borrowApy' | 'borrowedProgress'
>;

export const BorrowedSummary = ({
  borrowed,
  creditLimit,
  borrowApy,
  borrowedProgress,
}: BorrowedSummaryFigures) => (
  <>
    <Text className="px-5 text-[18px] font-medium leading-[18px] text-white">Borrowed</Text>
    <View style={styles.borrowedRow}>
      <Text className="text-[16px] font-normal leading-[16px] text-white/70">
        {borrowed} / {creditLimit}
      </Text>
      <Text className="text-[16px] font-normal leading-[16px] text-white/70">
        at {borrowApy} APY
      </Text>
    </View>
    <View style={styles.track}>
      {/* Clamped upstream, so this can only ever be 0–100%. */}
      <View style={[styles.fill, { width: `${borrowedProgress * 100}%` }]} />
    </View>
  </>
);

/** The borrowed block as the spend-mode sheet shows it (Figma 25961:3504). */
export const SpendModeBorrowedPanel = (figures: BorrowedSummaryFigures) => (
  <View style={[styles.panel, styles.borrowedPanel]}>
    <BorrowedSummary {...figures} />
  </View>
);

const styles = StyleSheet.create({
  panel: { backgroundColor: '#2B2B2B', borderRadius: 20, overflow: 'hidden' },

  // Figma 25950:2984 — 106pt tall, the text block and the pill both centred in it.
  balancePanel: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 106,
    paddingLeft: 23,
    paddingRight: 24,
  },
  balanceText: { flex: 1, gap: 10 },
  addFunds: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    height: 35,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },

  // 126pt tall: the title at 23, the figures 35 below it, the track 15 below those.
  borrowedPanel: { height: 126, paddingTop: 23 },
  borrowedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 17,
    paddingLeft: 20,
    paddingRight: 25,
  },
  // A 10pt round-capped stroke in Figma, so a 10pt bar with a 5pt radius here.
  track: {
    backgroundColor: '#464646',
    borderRadius: 5,
    height: 10,
    marginHorizontal: 23,
    marginTop: 15,
    overflow: 'hidden',
  },
  fill: { backgroundColor: '#94F27F', borderRadius: 5, height: 10 },
});
