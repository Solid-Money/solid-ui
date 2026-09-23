import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
} from 'react-native-reanimated';

import HelpBadge from '@/components/Card/NewCardDetails/SpendMode/HelpBadge';
import RepaySheetContent from '@/components/Card/NewCardDetails/SpendMode/RepaySheetContent';
import { BorrowedSummary } from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';
import { Text } from '@/components/ui/text';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import type { CardRepayRequest, CardRepayState } from '@/hooks/useCardRepay';

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

/** The same slide the spend-mode sheet swaps its panels on, so the two sheets move alike. */
const SWAP_DURATION = 240;

/** Everything the repay step needs, owned by the sheet so this file stays presentation. */
export interface BorrowPositionRepay {
  state: CardRepayState | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Resolves true once the repayment is on-chain, false when it did not happen. */
  onRepay: (request: CardRepayRequest) => Promise<boolean>;
  isRepaying: boolean;
  error: string | null;
  onClearError: () => void;
}

interface BorrowPositionSheetContentProps {
  figures: SpendModeFigures;
  onDismiss: () => void;
  repay: BorrowPositionRepay;
  /**
   * Bumped every time the sheet opens, which sends it back to the position — a sheet
   * reopened after backing out of a repayment should not come back halfway through one.
   */
  session: number;
  /** Space above the headline; sheets and the desktop modal clear different chrome. */
  topPadding?: number;
}

type SheetView = 'position' | 'repay';

/**
 * The borrow-position sheet: the position itself, and the repay step behind its Repay button.
 *
 * Both live in one sheet rather than a second one stacked on top, because repaying is a
 * continuation of reading the position, not a new task — and a sheet that slides its content
 * sideways keeps the cardholder's place, where a second sheet rising over the first hides it.
 * It slides like the spend-mode sheet: forward into Repay, back out of it, and back on its
 * own once a repayment lands, so the updated figures are the first thing seen after one.
 */
const BorrowPositionSheetContent = ({
  figures,
  onDismiss,
  repay,
  session,
  topPadding = BORROW_POSITION_SHEET_TOP,
}: BorrowPositionSheetContentProps) => {
  // `hasMoved` keeps the sheet's own entrance free of a sideways slide: only a move between
  // the two views animates, never the first paint of a sheet that has just opened.
  const [navigation, setNavigation] = useState<{ view: SheetView; hasMoved: boolean }>({
    view: 'position',
    hasMoved: false,
  });

  useEffect(() => {
    setNavigation({ view: 'position', hasMoved: false });
  }, [session]);

  const { onRepay, onClearError } = repay;

  const openRepay = useCallback(() => {
    onClearError();
    setNavigation({ view: 'repay', hasMoved: true });
  }, [onClearError]);

  const backToPosition = useCallback(() => {
    setNavigation({ view: 'position', hasMoved: true });
  }, []);

  const confirmRepay = useCallback(
    async (request: CardRepayRequest) => {
      const repaid = await onRepay(request);
      if (repaid) backToPosition();
      return repaid;
    },
    [backToPosition, onRepay],
  );

  const { view, hasMoved } = navigation;

  return (
    // Clipped, so the view sliding out does not paint over the sheet's rounded edge.
    //
    // Each view's directions are fixed rather than read from the last press. The position
    // sits to the left of Repay and is only ever left by going forward into it, and Repay is
    // only ever left by going back, so every direction is known in advance. It also has to
    // be: a removed view animates out with the `exiting` it was last RENDERED with, which a
    // direction held in state would still have at its previous value.
    <View style={styles.stage}>
      {view === 'position' ? (
        <Animated.View
          key="position"
          entering={hasMoved ? FadeInLeft.duration(SWAP_DURATION) : undefined}
          exiting={FadeOutLeft.duration(SWAP_DURATION)}
        >
          <PositionView
            figures={figures}
            onDismiss={onDismiss}
            onRepay={openRepay}
            topPadding={topPadding}
          />
        </Animated.View>
      ) : (
        <Animated.View
          key="repay"
          entering={FadeInRight.duration(SWAP_DURATION)}
          exiting={FadeOutRight.duration(SWAP_DURATION)}
        >
          <RepaySheetContent
            state={repay.state}
            isLoading={repay.isLoading}
            isError={repay.isError}
            onRetry={repay.onRetry}
            onRepay={confirmRepay}
            isRepaying={repay.isRepaying}
            error={repay.error}
            onClearError={onClearError}
            onBack={backToPosition}
            onDismiss={onDismiss}
            topPadding={topPadding}
          />
        </Animated.View>
      )}
    </View>
  );
};

interface PositionViewProps {
  figures: SpendModeFigures;
  onDismiss: () => void;
  onRepay: () => void;
  topPadding: number;
}

/**
 * The borrow position (Figma 26134:23880): what is still available to borrow, at
 * what rate, the loan itself with a Repay button, and the liquidation warning.
 *
 * The risk panel reads the health factor rather than always showing: the module
 * liquidates below 1.0, and the two bands above that are presentation — warning at
 * the boundary would tell someone their assets are being sold as it happens.
 */
const PositionView = ({ figures, onDismiss, onRepay, topPadding }: PositionViewProps) => (
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
          onPress={onRepay}
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
  stage: { overflow: 'hidden' },
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
