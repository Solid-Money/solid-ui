import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { EASE_OUT_QUINT } from '@/components/Card/NewCardDetails/heroMotion';
import {
  type CardSheetPresentation,
  sheetBodyInset,
} from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import HelpBadge from '@/components/Card/NewCardDetails/SpendMode/HelpBadge';
import SheetIconButton, {
  MODAL_CONTROL_SIZE,
} from '@/components/Card/NewCardDetails/SpendMode/SheetIconButton';
import {
  balancePanelHeight,
  BORROWED_PANEL_HEIGHT,
  creditPanelHeight,
  SPEND_MODE_NOTICE_HEIGHT,
  SpendModeBalancePanel,
  SpendModeBorrowedPanel,
  SpendModeCreditPanel,
  SpendModeNotice,
} from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';
import {
  offeredSpendModes,
  SPEND_MODE_COPY,
  SPEND_MODES,
  type SpendMode,
  type SpendModePanel,
} from '@/components/Card/NewCardDetails/SpendMode/spendModes';
import SpendModeSegmentedControl from '@/components/Card/NewCardDetails/SpendMode/SpendModeSegmentedControl';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import type { CreditModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';
import type { SpendableAssetRow } from '@/components/Card/NewCardDetails/SpendMode/useSpendableAssetRows';
import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

/**
 * Vertical rhythm, measured off the Figma sheets (419pt artboard; the Credit frame,
 * 26974:12806, is 644pt tall). Everything below is the gap from the element above it, so
 * a taller stack pushes the button down without the rest drifting.
 *
 *   heading top        50      subtitle           95
 *   control           143     caption           235
 *   notice            272     first panel       377   (a mode with a notice)
 *   action button     537
 *
 * A mode with no notice starts its first card closer: the balance panel
 * {@link CAPTION_TO_BALANCE_PANEL} below the caption (Figma 29120:9364), and Credit's
 * panel {@link CAPTION_TO_CREDIT_PANEL} below (Figma 29123:9389).
 *
 * The heading is given a 36pt line box rather than Figma's 24, which would clip
 * a 30pt face on Android; starting it at 50 puts that taller box back on the
 * centre line Figma's 56–80 box sits on.
 */
const HEADING_TO_SUBTITLE = 9;
const SUBTITLE_TO_CONTROL = 30;
const CONTROL_TO_CAPTION = 19;
/** Figma 29120:9364: the caption ends at 245, the balance panel starts at 277. */
const CAPTION_TO_BALANCE_PANEL = 32;
/** The Credit frame with collateral (Figma 29123:9389) starts its panel closer: 246 → 276. */
const CAPTION_TO_CREDIT_PANEL = 30;
const CAPTION_TO_NOTICE = 17;
const NOTICE_TO_PANEL = 42;
const PANEL_GAP = 12;
const PANEL_TO_ACTION = 34;
/** Where the heading starts, measured from the sheet's top edge. */
export const SPEND_MODE_SHEET_TOP = 50;
/** The sheet keeps this much below the button, before any safe-area inset. */
export const SPEND_MODE_SHEET_BOTTOM = 57;

/** A card in the stack: one of the mode's panels. */
type SheetCard = SpendModePanel;

/** What sizes the cards: the rows the balance and Credit panels list. */
interface StackSizes {
  balanceRows: readonly Pick<SpendableAssetRow, 'subtitle' | 'detail'>[];
  collateralRows: number;
}

/** The cards a mode stacks under its caption. */
const cardsFor = (mode: SpendMode): SheetCard[] => [...SPEND_MODE_COPY[mode].panels];

/** A card's height; the balance and Credit panels grow with the rows they list. */
const cardHeight = (card: SheetCard, sizes: StackSizes) =>
  card === 'balance'
    ? balancePanelHeight(sizes.balanceRows)
    : card === 'borrowed'
      ? BORROWED_PANEL_HEIGHT
      : creditPanelHeight(sizes.collateralRows);

/** Space from the caption to the first card's top, without any notice. */
const captionToCard = (first: SheetCard | undefined) =>
  first === 'credit' ? CAPTION_TO_CREDIT_PANEL : CAPTION_TO_BALANCE_PANEL;

/** Space from the caption to the first card, through the notice when the mode has one. */
const leadHeight = (mode: SpendMode, cards: readonly SheetCard[], noticeHeight: number) =>
  SPEND_MODE_COPY[mode].notice
    ? CAPTION_TO_NOTICE + noticeHeight + NOTICE_TO_PANEL
    : captionToCard(cards[0]);

/**
 * Room held below the caption: the tallest stack among the modes the picker offers —
 * Credit's panel and its collateral rows while Smart is hidden, Smart's two cards when shown.
 *
 * Without it the sheet changed height on every tap — the modes stack different cards — so
 * the drawer and its button jumped under the thumb that was browsing. Held at the tallest
 * offered, a shorter mode leaves space below its card and nothing else moves, and a hidden
 * mode reserves no space at all.
 */
const panelsMinHeight = (modes: readonly SpendMode[], noticeHeight: number, sizes: StackSizes) =>
  Math.max(
    ...modes.map(mode => {
      const cards = cardsFor(mode);
      const heights = cards.reduce(
        (sum, card, index) => sum + cardHeight(card, sizes) + (index > 0 ? PANEL_GAP : 0),
        0,
      );
      return leadHeight(mode, cards, noticeHeight) + heights;
    }),
  );

const SWAP_DURATION = 240;
const ACTION_FADE_DURATION = 260;
/** How far the action button fades back while the switch is in flight. */
const BUSY_DIM = 0.45;

interface SpendModeSheetContentProps {
  /**
   * The mode in force. It decides which segment goes solid white and turns the
   * button into a plain dismissal rather than a "Change to …".
   */
  activeMode: SpendMode;
  /** Every figure the panels and the control show. */
  figures: SpendModeFigures;
  /**
   * The Credit panel's figures, across Fuse and Base. Also what the Credit segment shows, so
   * the segment and the panel under it quote the same line.
   */
  credit: CreditModeFigures;
  /**
   * The balance panel's figures: "Your balance" across every spendable asset and the rows it is
   * made of, and `cash`, the dollar balance a Cash purchase draws on, for the Cash segment.
   */
  balance: { total: string; cash: string; rows: readonly SpendableAssetRow[] };
  /**
   * Bumped every time the sheet opens, which resets the selection so a sheet
   * reopened after browsing Credit doesn't come back still showing it.
   */
  session: number;
  /** Commit the previewed mode. Resolves once the change is on-chain. */
  onConfirm: (mode: SpendMode) => Promise<void>;
  /** True while the switch is signing or confirming. */
  isSwitching: boolean;
  /** Why the last attempt failed, or null. */
  error?: string | null;
  onDismiss: () => void;
  onHelpPress: () => void;
  onAddFunds?: () => void;
  /** Space above the heading; sheets and the desktop modal clear different chrome. */
  topPadding?: number;
  /** The desktop modal adds a close button to the heading row and drops the side inset. */
  presentation?: CardSheetPresentation;
}

/**
 * The body of the spend-mode sheet (Figma 25847:3581, 25961:3413, 25961:3538):
 * a heading, the three-way switch, a line explaining the highlighted mode, its
 * cards, and the button at the foot.
 *
 * Tapping a segment only *previews* that mode — the pill slides, the caption and
 * cards swap in from the side it came from — and nothing is committed until the
 * button at the foot is pressed. That separation is deliberate: the first switch
 * away from Cash also migrates the Safe between spend modules, which is a
 * signature, and browsing must never cost one.
 */
const SpendModeSheetContent = ({
  activeMode,
  figures,
  credit,
  balance,
  session,
  onConfirm,
  isSwitching,
  error,
  onDismiss,
  onHelpPress,
  onAddFunds,
  topPadding = SPEND_MODE_SHEET_TOP,
  presentation = 'sheet',
}: SpendModeSheetContentProps) => {
  // The direction of travel is kept with the selection rather than derived on
  // render, so the swap animation always matches the tap that caused it.
  const [selection, setSelection] = useState({ mode: activeMode, isForward: true });
  const { mode: selected, isForward } = selection;
  const modes = useMemo(() => offeredSpendModes(activeMode), [activeMode]);
  // The notice's real height, which a narrow sheet raises by wrapping it to a third line.
  // Measured rather than assumed, so the room held for Credit is the room it takes.
  const [noticeHeight, setNoticeHeight] = useState(SPEND_MODE_NOTICE_HEIGHT);
  const handleNoticeLayout = useCallback(
    (event: LayoutChangeEvent) => setNoticeHeight(event.nativeEvent.layout.height),
    [],
  );
  const sizes = useMemo(
    () => ({ balanceRows: balance.rows, collateralRows: credit.collateral.length }),
    [balance.rows, credit.collateral.length],
  );
  const panelsStyle = useMemo(
    () => ({ minHeight: panelsMinHeight(modes, noticeHeight, sizes) }),
    [modes, noticeHeight, sizes],
  );
  const cards = cardsFor(selected);
  const segmentValue = useMemo(
    () => ({ ...figures.segmentValue, cash: balance.cash, credit: credit.availableToBorrow }),
    [figures.segmentValue, balance.cash, credit.availableToBorrow],
  );
  const notice = SPEND_MODE_COPY[selected].notice;

  useEffect(() => {
    setSelection({ mode: activeMode, isForward: true });
  }, [activeMode, session]);

  const handleSelect = useCallback((next: SpendMode) => {
    setSelection(current =>
      current.mode === next
        ? current
        : {
            mode: next,
            isForward: SPEND_MODES.indexOf(next) > SPEND_MODES.indexOf(current.mode),
          },
    );
  }, []);

  // On the mode already in force there is nothing to change to, so the button is
  // the grey dismissal from the Cash frame instead of the green one.
  const isActiveSelected = selected === activeMode;
  const actionProgress = useSharedValue(isActiveSelected ? 0 : 1);

  useEffect(() => {
    actionProgress.value = withTiming(isActiveSelected ? 0 : 1, {
      duration: ACTION_FADE_DURATION,
      easing: EASE_OUT_QUINT,
    });
  }, [actionProgress, isActiveSelected]);

  // Dims the button while the switch is in flight. `disabled` below already blocks the
  // tap, but nothing said so: a fully lit button that ignores presses reads as broken
  // rather than busy, and this one can sit there for a while — the first switch away
  // from Cash is a migration, which is four contract calls behind one signature.
  const busyProgress = useSharedValue(isSwitching ? 1 : 0);

  useEffect(() => {
    busyProgress.value = withTiming(isSwitching ? 1 : 0, {
      duration: ACTION_FADE_DURATION,
      easing: EASE_OUT_QUINT,
    });
  }, [busyProgress, isSwitching]);

  const actionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(actionProgress.value, [0, 1], ['#404040', '#94F27F']),
    opacity: 1 - busyProgress.value * BUSY_DIM,
  }));

  const entering = (isForward ? FadeInRight : FadeInLeft).duration(SWAP_DURATION);
  const exiting = (isForward ? FadeOutLeft : FadeOutRight).duration(SWAP_DURATION);

  // On the mode already in force the button dismisses; anywhere else it commits. Guarded
  // against a double press because the first one costs a signature and, on a migration,
  // four contract calls.
  const handleAction = useCallback(() => {
    if (isSwitching) return;
    if (isActiveSelected) {
      onDismiss();
      return;
    }
    void onConfirm(selected);
  }, [isActiveSelected, isSwitching, onConfirm, onDismiss, selected]);

  return (
    <View style={{ paddingHorizontal: sheetBodyInset(presentation), paddingTop: topPadding }}>
      <View style={styles.heading}>
        <Text className="text-center text-[30px] font-medium leading-[36px] text-white">
          Spend mode
        </Text>
        {presentation === 'modal' ? (
          <SheetIconButton
            icon="close"
            accessibilityLabel="Close"
            onPress={onDismiss}
            style={styles.close}
          />
        ) : null}
      </View>
      <Text
        className="text-center text-[16px] font-normal leading-[18px] text-white/70"
        style={styles.subtitle}
      >
        Select your card spend mode
      </Text>

      <View style={styles.control}>
        <SpendModeSegmentedControl
          modes={modes}
          selected={selected}
          segmentValue={segmentValue}
          onSelect={handleSelect}
          // Locked while committing, for the same reason the button is. `onConfirm`
          // captured the mode as it was at the press, so a segment tapped mid-switch
          // would leave the sheet describing one mode while another is being signed.
          disabled={isSwitching}
        />
      </View>

      {/* Keyed on the mode so the caption and the cards leave together, towards
          the segment the user came from. */}
      <Animated.View
        key={`caption-${selected}`}
        entering={entering}
        exiting={exiting}
        style={styles.caption}
      >
        <Text className="text-center text-[16px] font-normal leading-[18px] text-white/70">
          {SPEND_MODE_COPY[selected].caption}
        </Text>
        <Pressable
          accessibilityLabel="How spend mode works"
          accessibilityRole="button"
          className="active:opacity-80"
          hitSlop={12}
          onPress={onHelpPress}
        >
          <HelpBadge />
        </Pressable>
      </Animated.View>

      {/* Not keyed, so it holds its height while the keyed panels swap inside it. */}
      <View style={panelsStyle}>
        <Animated.View
          key={`panels-${selected}`}
          entering={entering}
          exiting={exiting}
          style={{ paddingTop: notice ? CAPTION_TO_NOTICE : captionToCard(cards[0]) }}
        >
          {notice ? (
            <View style={styles.notice}>
              <SpendModeNotice message={notice} onLayout={handleNoticeLayout} />
            </View>
          ) : null}
          {cards.map((panel, index) => (
            <View key={panel} style={index > 0 ? { marginTop: PANEL_GAP } : undefined}>
              {panel === 'balance' ? (
                <SpendModeBalancePanel
                  balance={balance.total}
                  rows={balance.rows}
                  onAddFunds={onAddFunds}
                  onHelpPress={onHelpPress}
                />
              ) : panel === 'credit' ? (
                <SpendModeCreditPanel
                  borrowed={credit.borrowed}
                  creditLimit={credit.creditLimit}
                  borrowApy={credit.borrowApy}
                  borrowedProgress={credit.borrowedProgress}
                  collateral={credit.collateral}
                  onHelpPress={onHelpPress}
                />
              ) : (
                <SpendModeBorrowedPanel
                  borrowed={figures.borrowed}
                  creditLimit={figures.creditLimit}
                  borrowApy={figures.borrowApy}
                  borrowedProgress={figures.borrowedProgress}
                />
              )}
            </View>
          ))}
        </Animated.View>
      </View>

      {error ? (
        <Text className="mt-4 text-center text-[14px] font-normal leading-[18px] text-[#D96167]">
          {error}
        </Text>
      ) : null}

      <Animated.View style={[styles.action, actionStyle]}>
        <Pressable
          accessibilityLabel={
            isSwitching
              ? 'Confirming spend mode change'
              : isActiveSelected
                ? 'Close'
                : `Change to ${SPEND_MODE_COPY[selected].label}`
          }
          accessibilityRole="button"
          // `busy` as well as `disabled`: to a screen reader those are different
          // facts, and "dimmed because something is happening" is the one here.
          accessibilityState={{ disabled: isSwitching, busy: isSwitching }}
          disabled={isSwitching}
          onPress={handleAction}
          style={styles.actionPress}
        >
          {/* Keyed on what is shown, so the white "Cancel" cross-fades into the
              black "Change to …" rather than switching colour mid-tint — and so
              the spinner fades in with its label instead of appearing beside a
              caption that has already changed underneath it. */}
          <Animated.View
            key={
              isSwitching
                ? 'confirming'
                : isActiveSelected
                  ? 'dismiss'
                  : SPEND_MODE_COPY[selected].label
            }
            entering={FadeIn.duration(ACTION_FADE_DURATION)}
            exiting={FadeOut.duration(ACTION_FADE_DURATION / 2)}
            style={styles.actionContent}
          >
            {/* Beside the label rather than in place of it. "Confirming…" is worth
                keeping: this is a signature followed by on-chain confirmation, and a
                bare spinner on a sheet that has not moved invites a second tap. */}
            {isSwitching ? (
              <ActivityIndicator size="small" color={isActiveSelected ? '#FFFFFF' : '#000000'} />
            ) : null}
            <Text
              className={cn(
                'text-[16px] font-semibold',
                isActiveSelected ? 'text-white' : 'text-black',
              )}
            >
              {isSwitching
                ? 'Confirming…'
                : isActiveSelected
                  ? 'Cancel'
                  : `Change to ${SPEND_MODE_COPY[selected].label}`}
            </Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Hold enough room for the circular control so it stays inside the heading.
  heading: { height: MODAL_CONTROL_SIZE, justifyContent: 'center' },
  close: { position: 'absolute', right: 0, top: 0 },
  subtitle: { marginTop: HEADING_TO_SUBTITLE },
  control: { marginTop: SUBTITLE_TO_CONTROL },
  caption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: CONTROL_TO_CAPTION,
  },
  notice: { marginBottom: NOTICE_TO_PANEL },
  action: { borderRadius: 100, marginTop: PANEL_TO_ACTION, overflow: 'hidden' },
  actionPress: { alignItems: 'center', height: 50, justifyContent: 'center' },
  actionContent: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
});

export default SpendModeSheetContent;
