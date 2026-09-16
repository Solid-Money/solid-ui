import { Pressable, StyleSheet, View } from 'react-native';

import HelpBadge from '@/components/Card/NewCardDetails/SpendMode/HelpBadge';
import { BorrowedSummary } from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';
import { Text } from '@/components/ui/text';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

/**
 * Vertical rhythm, measured off Figma 26134:23880 (419 × 670 on the artboard).
 * Each value is the gap from the element above it.
 *
 *   headline top   50      apy pill    139
 *   borrowed card  209     at risk     433
 *   cancel         567     sheet ends  670
 */
export const BORROW_POSITION_SHEET_TOP = 50;
export const BORROW_POSITION_SHEET_BOTTOM = 53;
const AMOUNT_TO_APY = 3;
const APY_TO_CARD = 35;
const CARD_TO_RISK = 25;
const RISK_TO_CANCEL = 36;
/** Figma puts Repay 29 below the track and 23 above the card's bottom edge. */
const TRACK_TO_REPAY = 29;

interface BorrowPositionSheetContentProps {
  figures: SpendModeFigures;
  onDismiss: () => void;
  /** Opens the repay flow. Not wired yet — see the note below. */
  onRepay?: () => void;
  /** Space above the headline; sheets and the desktop modal clear different chrome. */
  topPadding?: number;
}

/**
 * The borrow position (Figma 26134:23880): what is still available to borrow, at
 * what rate, the loan itself with a Repay button, and the liquidation warning.
 *
 * Every figure is live. **Repay is not** — it still just closes the sheet, which is
 * the one thing on this screen that does not do what it says. Repaying needs an
 * amount, a token choice and its own confirmation, and is a separate pass; until it
 * lands, a cardholder who needs to reduce a position does it from the borrow flow.
 *
 * The risk panel reads the health factor rather than always showing: the module
 * liquidates below 1.0, and the two bands above that are presentation — warning at
 * the boundary would tell someone their assets are being sold as it happens.
 */
const BorrowPositionSheetContent = ({
  figures,
  onDismiss,
  onRepay,
  topPadding = BORROW_POSITION_SHEET_TOP,
}: BorrowPositionSheetContentProps) => (
  <View style={[styles.body, { paddingTop: topPadding }]}>
    <Text className="text-center text-[16px] font-medium leading-[23px] text-white/70">
      Available to borrow
    </Text>
    <Text className="text-center text-[45px] font-semibold leading-[63px] text-white">
      {figures.availableToBorrow}
    </Text>

    <View style={styles.apy}>
      <Text className="text-[16px] font-semibold text-white">{figures.borrowApy} APY</Text>
      <HelpBadge />
    </View>

    <View style={styles.positionCard}>
      <BorrowedSummary
        borrowed={figures.borrowed}
        creditLimit={figures.creditLimit}
        borrowApy={figures.borrowApy}
        borrowedProgress={figures.borrowedProgress}
      />
      {/* Nothing borrowed, nothing to repay. The sheet is now reachable before the first
          draw — it is where a cardholder goes to see their line — and a Repay button on a
          position of zero is an offer to do something that cannot be done. */}
      {figures.hasPosition ? (
        <Pressable
          accessibilityLabel="Repay"
          accessibilityRole="button"
          className="bg-brand transition-all active:scale-95 active:opacity-80"
          onPress={onRepay ?? onDismiss}
          style={styles.repay}
        >
          <Text className="text-[16px] font-bold text-black">Repay</Text>
        </Pressable>
      ) : null}
    </View>

    {/* Figma 26134:23892 — the only red on this screen, so the tint, the border
        and the glyph all key off the one colour. Shown only when the position is
        actually close to liquidation; a permanent warning is one nobody reads. */}
    {figures.risk === 'none' ? null : (
      <View style={styles.risk}>
        <View style={styles.riskIcon}>
          <Text className="text-[28px] font-medium leading-[28px] text-[#D96167]">!</Text>
        </View>
        <View style={styles.riskText}>
          <Text className="text-[18px] font-medium leading-[18px] text-[#D96167]">
            {figures.risk === 'at-risk' ? 'At risk' : 'Getting close'}
          </Text>
          <Text className="mt-[7px] text-[16px] font-normal leading-[18px] text-white">
            {figures.risk === 'at-risk'
              ? 'Repay now to avoid your assets being sold to cover the loan'
              : 'Repay some of your loan to keep your assets safe'}
          </Text>
        </View>
      </View>
    )}

    <Pressable
      accessibilityLabel="Close"
      accessibilityRole="button"
      className="transition-all active:scale-95 active:opacity-80"
      onPress={onDismiss}
      style={styles.cancel}
    >
      <Text className="text-[16px] font-semibold text-white">Cancel</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  // 17pt inset either side, which is the 385pt content block on the 419pt frame.
  body: { paddingHorizontal: 17 },
  apy: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#2B2B2B',
    borderRadius: 100,
    flexDirection: 'row',
    gap: 8,
    height: 35,
    marginTop: AMOUNT_TO_APY,
    paddingLeft: 15,
    paddingRight: 13,
  },
  positionCard: {
    backgroundColor: '#2B2B2B',
    borderRadius: 20,
    marginTop: APY_TO_CARD,
    overflow: 'hidden',
    paddingBottom: 23,
    paddingTop: 23,
  },
  repay: {
    alignItems: 'center',
    borderRadius: 30,
    height: 48,
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: TRACK_TO_REPAY,
  },
  risk: {
    backgroundColor: 'rgba(195,66,72,0.15)',
    borderColor: 'rgba(195,66,72,0.6)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    height: 98,
    marginTop: CARD_TO_RISK,
    overflow: 'hidden',
    paddingLeft: 19,
  },
  riskIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(195,66,72,0.2)',
    borderRadius: 100,
    height: 49,
    justifyContent: 'center',
    marginTop: 25,
    width: 50,
  },
  riskText: { flex: 1, marginLeft: 20, marginTop: 20, paddingRight: 24 },
  cancel: {
    alignItems: 'center',
    backgroundColor: '#404040',
    borderRadius: 100,
    height: 50,
    justifyContent: 'center',
    marginTop: RISK_TO_CANCEL,
  },
});

export default BorrowPositionSheetContent;
