import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

/**
 * The cards the spend-mode surfaces are built from.
 *
 * Presentation only: every figure arrives as a prop from `useSpendModeFigures`, so the
 * same block shows the same number wherever it is placed.
 */

/** Figma 25950:2984. Fixed, so the sheet can reserve room for any stack of these. */
export const BALANCE_PANEL_HEIGHT = 106;
/** Figma 25961:3504. See {@link BALANCE_PANEL_HEIGHT}. */
export const BORROWED_PANEL_HEIGHT = 126;
/**
 * Figma 26974:14829, at its two-line wrap on the 419pt artboard. Not fixed like the panels:
 * a narrower sheet wraps the message to a third line, so the sheet measures the real one.
 */
export const SPEND_MODE_NOTICE_HEIGHT = 63;

const NOTICE_BACKGROUND = require('@/assets/images/spend-mode-credit-notice-bg.png');
const NOTICE_BADGE = require('@/assets/images/spend-mode-credit-notice-badge.svg');

interface BalancePanelProps {
  balance: string;
  /**
   * Opens the add-funds flow. Without one the pill is not drawn: it used to render with
   * nothing behind it, and a button that ignores the tap reads as broken.
   */
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
    {onAddFunds ? (
      <Pressable
        accessibilityLabel="Add funds"
        accessibilityRole="button"
        className="transition-all active:scale-95 active:opacity-80"
        onPress={onAddFunds}
        style={styles.addFunds}
      >
        <Text className="text-[16px] font-semibold text-black">Add funds</Text>
      </Pressable>
    ) : null}
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

interface NoticeProps {
  message: string;
  /** Reports the rendered height, which grows when the message wraps further. */
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * "! Currently credit mode works only with your USD yield balance" — a caveat about the
 * highlighted mode, in yellow on a faint yellow wash (Figma 26974:14829).
 */
export const SpendModeNotice = ({ message, onLayout }: NoticeProps) => (
  <View onLayout={onLayout} style={styles.notice}>
    <Image
      accessible={false}
      source={NOTICE_BACKGROUND}
      contentFit="cover"
      style={StyleSheet.absoluteFill}
    />
    <View accessible={false} style={styles.noticeBadge}>
      <Image source={NOTICE_BADGE} style={StyleSheet.absoluteFill} />
      <Text className="text-[16px] font-extrabold leading-[18px] text-[#FFD151]">!</Text>
    </View>
    <Text className="flex-1 text-[16px] font-normal leading-[18px] text-[#FFD151]">{message}</Text>
  </View>
);

/** The borrowed block as the spend-mode sheet shows it (Figma 25961:3504). */
export const SpendModeBorrowedPanel = (figures: BorrowedSummaryFigures) => (
  <View style={[styles.panel, styles.borrowedPanel]}>
    <BorrowedSummary {...figures} />
  </View>
);

const styles = StyleSheet.create({
  panel: { backgroundColor: '#2B2B2B', borderRadius: 20, overflow: 'hidden' },

  // The text block and the pill both centred in the panel.
  balancePanel: {
    alignItems: 'center',
    flexDirection: 'row',
    height: BALANCE_PANEL_HEIGHT,
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
  borrowedPanel: { height: BORROWED_PANEL_HEIGHT, paddingTop: 23 },
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

  // Figma places the badge at 15, the message at 50.5 and 12 from the top, and leaves 15
  // under it and 17.5 after it — all from the outer edge. Padding here starts inside the
  // 1pt border, so each is one less; the badge then centres on the message block.
  notice: {
    alignItems: 'center',
    borderColor: 'rgba(255, 209, 81, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13.5,
    overflow: 'hidden',
    paddingBottom: 14,
    paddingLeft: 14,
    paddingRight: 16.5,
    paddingTop: 11,
  },
  noticeBadge: { alignItems: 'center', height: 22, justifyContent: 'center', width: 22 },
});
