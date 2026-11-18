import {
  createContext,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type AnimatedRef,
  cancelAnimation,
  Easing,
  type FrameInfo,
  interpolateColor,
  measure,
  ReduceMotion,
  scrollTo,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useScrollOffset,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';

import { DragHandleIcon } from './OrderIcons';
import {
  autoScrollSpeed,
  heightOfAll,
  moveSlot,
  REORDER_DIVIDER,
  reorderAt,
  sameSlots,
  type SlotGeometry,
  slotStates,
  topOf,
} from './reorder';

/**
 * A drag-to-reorder list for a handful of fixed-height rows, with an optional divider that splits
 * the rows into two groups (the Spend order screen's "Your card won’t use").
 *
 * Built to stay smooth on a mid-range phone, so the rules are strict about what runs where:
 *
 * - Rows are absolutely placed and moved with `transform: translateY` only. Nothing animates a
 *   layout prop, so a drag never re-runs Yoga layout.
 * - The drag runs on the UI thread. The gesture writes the finger's position to a shared value;
 *   one worklet works out the lifted row's top, the new order and the auto-scroll, and writes the
 *   top into the lifted row's own translate. Only that row's style runs per frame; the others run
 *   when the order moves them. No JavaScript runs per frame.
 * - JavaScript hears about a drag four times at most per swap or end: the lift and the drop (for
 *   haptics), each swap (rank numbers and subtitles, re-rendering only the memoised rows whose rank
 *   or side of the divider changed), and the commit, at the drop.
 * - The page does not scroll under a lifted row: its scroll view takes part in the gesture system
 *   ({@link ReorderableScrollView}), so a row that lifts cancels the scroll, and a UI-thread flag
 *   turns scrolling off until the drop — no React state, so the screen does not re-render.
 */

/** A row's place in the order, for drawing it. */
export interface ReorderableItemState {
  /** 1 for the top row; undefined below the divider. */
  rank: number | undefined;
  /** Below the divider. */
  excluded: boolean;
}

export interface ReorderableDivider {
  /** The divider's key in `data`; {@link REORDER_DIVIDER} by default. */
  key?: string;
  height: number;
  render: () => ReactNode;
  /** The screen-reader action that moves a row up across the divider ("Use"). */
  upLabel: string;
  /** The one that moves a row down across it ("Don’t use"). */
  downLabel: string;
  /** How faint a row below the divider is drawn. */
  dimmedOpacity?: number;
}

export interface ReorderableListProps {
  /** Row keys in order, and the divider's key among them when there is one. */
  data: readonly string[];
  /** The new order, as a row is dropped or a screen-reader move is made. */
  onReorder: (next: string[]) => void;
  /**
   * A row's content, laid out in a row before the drag handle. Must be a stable function
   * (`useCallback`): a row re-renders when it changes, and the list re-renders on every swap.
   */
  renderItem: (key: string, state: ReorderableItemState) => ReactNode;
  /** Stable, like `renderItem`. */
  getItemAccessibilityLabel: (key: string, state: ReorderableItemState) => string;
  itemHeight: number;
  divider?: ReorderableDivider;
  /** The panel around the rows. */
  style?: StyleProp<ViewStyle>;
  /** Each row's content row: its padding and the gap between the pieces. */
  rowStyle?: StyleProp<ViewStyle>;
}

const IS_WEB = Platform.OS === 'web';
/**
 * A touch screen on the web. Every gesture's view there takes `touch-action: none`, so a row that
 * drags would also stop a swipe from scrolling the page: the rows stay still and only the handle
 * drags.
 */
const WEB_TOUCH = IS_WEB && typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
/** Hold this long anywhere on a row before it lifts, so a swipe still scrolls the page. */
const LONG_PRESS_MS = 200;
/**
 * The handle's shorter hold on a touch screen: long enough that a swipe starting on it (it covers
 * most of the rows' right edge) moves off and scrolls the page, or a tap that stops a fling does
 * not lift a row.
 */
const HANDLE_HOLD_MS = 100;
/** A mouse lifts a row once it moves this far. */
const WEB_MIN_DISTANCE = 4;
/** Which of a row's two gestures holds its drag. */
const NO_GESTURE = 0;
const ROW_GESTURE = 1;
const HANDLE_GESTURE = 2;
/** The handle's touch area reaches past its 20pt icon, to 44pt tall and to the row's edge. */
const HANDLE_HIT_SLOP = { left: 12, right: 16, top: 12, bottom: 12 };
/** How far a lifted row grows. */
const LIFT_SCALE = 0.02;
const LIFTED_BACKGROUND = '#343434';
const RESTING_BACKGROUND = 'rgba(52, 52, 52, 0)';
const LIFTED_SHADOW_OPACITY = 0.35;
const LIFTED_ELEVATION = 10;
const DIMMED_OPACITY = 0.45;
/** A row must clear its neighbour's midpoint by this much to swap, so a resting finger does not. */
const SWAP_HYSTERESIS = 6;
/** The band at either end of the visible page in which a lifted row scrolls it. */
const AUTO_SCROLL_EDGE = 80;
/** Points per 60 Hz frame at the very edge. */
const AUTO_SCROLL_MAX_SPEED = 14;
const FRAME_MS = 1000 / 60;

/** Siblings sliding out of the way, and the dropped row settling: critically damped, no bounce. */
const SLIDE = { dampingRatio: 1, duration: 180, overshootClamping: true } as const;
const LIFT_IN = { duration: 160, easing: Easing.out(Easing.cubic) } as const;
const LIFT_OUT = { duration: 220, easing: Easing.out(Easing.cubic) } as const;
const FADE = { duration: 150, easing: Easing.out(Easing.quad) } as const;
/** With Reduce Motion on, the fades stay and are short; nothing slides or grows. */
const REDUCED_FADE = { duration: 120, reduceMotion: ReduceMotion.Never } as const;

const haptic = (kind: 'lift' | 'swap' | 'drop') => {
  if (Platform.OS === 'web') return;
  if (kind === 'swap') void Haptics.selectionAsync();
  else
    void Haptics.impactAsync(
      kind === 'lift' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
};

// ---------------------------------------------------------------------------------------------
// The scroll container
// ---------------------------------------------------------------------------------------------

interface ReorderableScroll {
  scrollRef: AnimatedRef<Animated.ScrollView>;
  offset: SharedValue<number>;
  contentHeight: SharedValue<number>;
  /** True while a row is lifted: the page does not scroll under it. */
  locked: SharedValue<boolean>;
}

const ReorderableScrollContext = createContext<ReorderableScroll | null>(null);

/**
 * The page's scroll view, for a screen with a {@link ReorderableList} in it: the list auto-scrolls
 * it when a lifted row nears the top or bottom, and it stops scrolling while a row is lifted.
 *
 * Wrapped in a native gesture so it takes part in the gesture system: a swipe that starts on a row
 * scrolls the page (the row's long press fails as the finger moves), and a row that lifts cancels
 * the scroll. On native the `scrollEnabled` prop is driven from the UI thread as well, so nothing
 * can scroll the page under the lifted row.
 */
export const ReorderableScrollView = ({
  children,
  onContentSizeChange,
  ...props
}: Omit<ScrollViewProps, 'scrollEnabled'> & { children: ReactNode }) => {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const offset = useScrollOffset(scrollRef);
  const contentHeight = useSharedValue(0);
  const locked = useSharedValue(false);
  const native = useMemo(() => Gesture.Native(), []);
  const animatedProps = useAnimatedProps(() => ({ scrollEnabled: !locked.value }));

  const scroll = useMemo<ReorderableScroll>(
    () => ({ scrollRef, offset, contentHeight, locked }),
    [scrollRef, offset, contentHeight, locked],
  );

  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      contentHeight.value = height;
      onContentSizeChange?.(width, height);
    },
    [contentHeight, onContentSizeChange],
  );

  return (
    <ReorderableScrollContext.Provider value={scroll}>
      <GestureDetector gesture={native}>
        <Animated.ScrollView
          ref={scrollRef}
          {...props}
          // A mouse drag does not scroll a web page, and react-native-web reads `scrollEnabled`
          // only as a render prop, so the UI-thread toggle is native-only.
          animatedProps={Platform.OS === 'web' ? undefined : animatedProps}
          onContentSizeChange={handleContentSizeChange}
        >
          {children}
        </Animated.ScrollView>
      </GestureDetector>
    </ReorderableScrollContext.Provider>
  );
};

// ---------------------------------------------------------------------------------------------
// Drag state shared by the rows
// ---------------------------------------------------------------------------------------------

interface DragContext {
  geometry: SlotGeometry;
  reduceMotion: boolean;
  dimmedOpacity: number;
  /** The live order, rewritten on the UI thread as the lifted row passes others. */
  order: SharedValue<string[]>;
  /** The key of the lifted row, or null. */
  active: SharedValue<string | null>;
  /** The lifted row's top, from the top of the list. */
  dragTop: SharedValue<number>;
  dragStartTop: SharedValue<number>;
  startAbsoluteY: SharedValue<number>;
  touchAbsoluteY: SharedValue<number>;
  scrollStart: SharedValue<number>;
  scrollNow: SharedValue<number>;
  /** The page's scroll offset as last read by `step` (web only, where the page is not locked). */
  scrollSeen: SharedValue<number>;
  listTopInViewport: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  listRef: AnimatedRef<Animated.View>;
  scroll: ReorderableScroll | null;
  /**
   * Recomputes the lifted row's top, the order and (with `frameMs`) the auto-scroll, and writes the
   * top into `translate`, the lifted row's own.
   */
  step: (frameMs: number, translate: SharedValue<number>) => void;
  /** Commits the live order if it differs from the one on screen. */
  commit: () => void;
  onLift: () => void;
  onDrop: () => void;
}

// ---------------------------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------------------------

export const ReorderableList = ({
  data,
  onReorder,
  renderItem,
  getItemAccessibilityLabel,
  itemHeight,
  divider,
  style,
  rowStyle,
}: ReorderableListProps) => {
  const scroll = useContext(ReorderableScrollContext);
  const reduceMotion = useReducedMotion();
  const dividerKey = divider ? (divider.key ?? REORDER_DIVIDER) : null;
  const dividerHeight = divider?.height ?? 0;
  const dimmedOpacity = divider?.dimmedOpacity ?? DIMMED_OPACITY;

  const listRef = useAnimatedRef<Animated.View>();
  const order = useSharedValue<string[]>([...data]);
  const committed = useSharedValue<string[]>([...data]);
  const active = useSharedValue<string | null>(null);
  const dragTop = useSharedValue(0);
  const dragStartTop = useSharedValue(0);
  const startAbsoluteY = useSharedValue(0);
  const touchAbsoluteY = useSharedValue(0);
  const scrollStart = useSharedValue(0);
  const scrollNow = useSharedValue(0);
  const scrollSeen = useSharedValue(0);
  const listTopInViewport = useSharedValue(0);
  const viewportHeight = useSharedValue(0);

  // The order the rows show their rank and side of the divider by: the one on screen, or while a
  // row is dragged, the live order as of the last swap. Falls back to `data` as soon as a different
  // order arrives, so a Reset never shows a stale rank; compared by content, so a parent that
  // rebuilds the same order mid-drag (a balance refresh) does not snap the ranks back.
  const [live, setLive] = useState<{ base: readonly string[]; slots: readonly string[] }>({
    base: data,
    slots: data,
  });
  const slots = sameSlots(live.base, data) ? live.slots : data;

  const latest = useRef({ data, onReorder });
  useLayoutEffect(() => {
    latest.current = { data, onReorder };
  });

  // A Reset, a commit or the rows landing replace the order from outside the drag.
  useEffect(() => {
    committed.value = [...data];
    if (active.value === null && !sameSlots(order.value, data)) order.value = [...data];
  }, [active, committed, data, order]);

  const onLift = useCallback(() => {
    haptic('lift');
  }, []);

  const onSwap = useCallback((next: string[]) => {
    setLive({ base: latest.current.data, slots: next });
    haptic('swap');
  }, []);

  const onDrop = useCallback(() => {
    haptic('drop');
  }, []);

  const onCommit = useCallback(
    (next: string[]) => {
      const current = latest.current.data;
      // Rows that came or went mid-drag: drop the drag rather than commit an order missing them.
      const sameKeys = next.length === current.length && current.every(key => next.includes(key));
      if (!sameKeys) {
        order.value = [...current];
        return;
      }
      if (sameSlots(next, current)) return;
      // The committed order is the one to rank by from here; a later Reset then reads as new.
      setLive({ base: next, slots: next });
      latest.current.onReorder(next);
    },
    [order],
  );

  const ctx = useMemo<DragContext>(() => {
    const geometry: SlotGeometry = { itemHeight, dividerKey, dividerHeight };

    const step = (frameMs: number, translate: SharedValue<number>) => {
      'worklet';
      const key = active.value;
      if (key === null) return;
      // Only native stops the page scrolling under a lifted row. On the web a wheel or trackpad can
      // still scroll it, and `scrollNow` follows only this worklet's own `scrollTo`: take whatever
      // the page last reported (which is also where our own scroll landed) as where it is.
      if (IS_WEB && scroll && scroll.offset.value !== scrollSeen.value) {
        scrollSeen.value = scroll.offset.value;
        scrollNow.value = scroll.offset.value;
      }
      const maxTop = heightOfAll(committed.value, geometry) - itemHeight;

      if (scroll && frameMs > 0 && viewportHeight.value > 0) {
        const rowTop =
          listTopInViewport.value + dragTop.value - (scrollNow.value - scrollStart.value);
        const speed = autoScrollSpeed(
          rowTop,
          rowTop + itemHeight,
          viewportHeight.value,
          AUTO_SCROLL_EDGE,
          AUTO_SCROLL_MAX_SPEED,
          dragTop.value > 0,
          dragTop.value < maxTop,
        );
        if (speed !== 0) {
          const maxScroll = Math.max(0, scroll.contentHeight.value - viewportHeight.value);
          const next = Math.min(
            maxScroll,
            Math.max(0, scrollNow.value + (speed * frameMs) / FRAME_MS),
          );
          if (next !== scrollNow.value) {
            scrollNow.value = next;
            scrollTo(scroll.scrollRef, 0, next, false);
          }
        }
      }

      // The finger's travel plus however far the page scrolled under it since the lift.
      const top = Math.min(
        maxTop,
        Math.max(
          0,
          dragStartTop.value +
            (touchAbsoluteY.value - startAbsoluteY.value) +
            (scrollNow.value - scrollStart.value),
        ),
      );
      dragTop.value = top;
      translate.value = top;

      const current = order.value;
      const next = reorderAt(current, key, top, geometry, SWAP_HYSTERESIS);
      if (next !== current) {
        const copy = [...next];
        order.value = copy;
        scheduleOnRN(onSwap, copy);
      }
    };

    const commit = () => {
      'worklet';
      if (!sameSlots(order.value, committed.value)) scheduleOnRN(onCommit, [...order.value]);
    };

    return {
      geometry,
      reduceMotion,
      dimmedOpacity,
      order,
      active,
      dragTop,
      dragStartTop,
      startAbsoluteY,
      touchAbsoluteY,
      scrollStart,
      scrollNow,
      scrollSeen,
      listTopInViewport,
      viewportHeight,
      listRef,
      scroll,
      step,
      commit,
      onLift,
      onDrop,
    };
  }, [
    active,
    committed,
    dimmedOpacity,
    dividerHeight,
    dividerKey,
    dragStartTop,
    dragTop,
    itemHeight,
    listRef,
    listTopInViewport,
    onCommit,
    onDrop,
    onLift,
    onSwap,
    order,
    reduceMotion,
    scroll,
    scrollNow,
    scrollSeen,
    scrollStart,
    startAbsoluteY,
    touchAbsoluteY,
    viewportHeight,
  ]);

  const handleMove = useCallback((key: string, delta: -1 | 1) => {
    const { data: current, onReorder: reorder } = latest.current;
    reorder(moveSlot(current, key, delta));
  }, []);

  const states = useMemo(() => slotStates(slots, dividerKey), [slots, dividerKey]);

  return (
    <View style={[styles.panel, style]}>
      <Animated.View ref={listRef} style={{ height: heightOfAll(data, ctx.geometry) }}>
        {data.map(key => {
          const initialTop = topOf(data, key, ctx.geometry);
          if (key === dividerKey && divider) {
            return (
              <DividerSlot
                key={key}
                slotKey={key}
                height={divider.height}
                initialTop={initialTop}
                ctx={ctx}
                render={divider.render}
              />
            );
          }
          const state = states.get(key);
          if (!state) return null;
          return (
            <ReorderableRow
              key={key}
              itemKey={key}
              initialTop={initialTop}
              rank={state.rank}
              excluded={state.excluded}
              upLabel={
                state.canMoveUp
                  ? state.upCrossesDivider
                    ? divider?.upLabel
                    : 'Move up'
                  : undefined
              }
              downLabel={
                state.canMoveDown
                  ? state.downCrossesDivider
                    ? divider?.downLabel
                    : 'Move down'
                  : undefined
              }
              ctx={ctx}
              renderItem={renderItem}
              getAccessibilityLabel={getItemAccessibilityLabel}
              onMove={handleMove}
              rowStyle={rowStyle}
            />
          );
        })}
      </Animated.View>
    </View>
  );
};

// ---------------------------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------------------------

/**
 * A slot's resting top, kept in step with the live order. Animated on the UI thread whenever the
 * order changes — a sibling sliding out of the lifted row's way, or every row on a Reset.
 */
const useSlotTop = (slotKey: string, initialTop: number, ctx: DragContext) => {
  const y = useSharedValue(initialTop);
  const { order, active, geometry, reduceMotion } = ctx;

  useAnimatedReaction(
    () => topOf(order.value, slotKey, geometry),
    (top, previous) => {
      if (previous === null || top === previous) return;
      // The lifted row follows the finger; it is placed when it drops.
      if (active.value === slotKey) return;
      y.value = reduceMotion ? top : withSpring(top, SLIDE);
    },
  );

  return y;
};

interface DividerSlotProps {
  slotKey: string;
  height: number;
  initialTop: number;
  ctx: DragContext;
  render: () => ReactNode;
}

const DividerSlot = memo(function DividerSlot({
  slotKey,
  height,
  initialTop,
  ctx,
  render,
}: DividerSlotProps) {
  const y = useSlotTop(slotKey, initialTop, ctx);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return <Animated.View style={[styles.slot, { height }, style]}>{render()}</Animated.View>;
});

interface ReorderableRowProps {
  itemKey: string;
  initialTop: number;
  rank: number | undefined;
  excluded: boolean;
  /** The screen-reader actions' labels; undefined where the move is not possible. */
  upLabel: string | undefined;
  downLabel: string | undefined;
  ctx: DragContext;
  renderItem: ReorderableListProps['renderItem'];
  getAccessibilityLabel: ReorderableListProps['getItemAccessibilityLabel'];
  onMove: (key: string, delta: -1 | 1) => void;
  rowStyle?: StyleProp<ViewStyle>;
}

/**
 * One draggable row. Memoised on primitives, so a swap re-renders only the rows whose rank or side
 * of the divider changed; everything that moves is an animated style on the UI thread.
 */
const ReorderableRow = memo(function ReorderableRow({
  itemKey,
  initialTop,
  rank,
  excluded,
  upLabel,
  downLabel,
  ctx,
  renderItem,
  getAccessibilityLabel,
  onMove,
  rowStyle,
}: ReorderableRowProps) {
  const y = useSlotTop(itemKey, initialTop, ctx);
  const lift = useSharedValue(0);
  const dim = useSharedValue(excluded ? ctx.dimmedOpacity : 1);
  /**
   * Which of this row's gestures holds the drag ({@link ROW_GESTURE} or {@link HANDLE_GESTURE}), if
   * either does (another finger may already hold one). Per gesture, so the one that did not win
   * finishing — whenever the platform reports it — never drops the other's drag.
   */
  const owner = useSharedValue(NO_GESTURE);

  const {
    geometry,
    reduceMotion,
    dimmedOpacity,
    order,
    active,
    dragTop,
    dragStartTop,
    startAbsoluteY,
    touchAbsoluteY,
    scrollStart,
    scrollNow,
    scrollSeen,
    listTopInViewport,
    viewportHeight,
    listRef,
    scroll,
    step,
    commit,
    onLift,
    onDrop,
  } = ctx;

  // Auto-scroll needs a tick while the finger rests near an edge, when no gesture event arrives.
  // Each row has its own, so the tick writes straight into the lifted row's translate; off until
  // this row lifts, so an idle screen runs no per-frame work at all. Memoised: `useFrameCallback`
  // re-registers whenever its callback changes.
  const tick = useCallback(
    (info: FrameInfo) => {
      'worklet';
      step(info.timeSincePreviousFrame ?? FRAME_MS, y);
    },
    [step, y],
  );
  const frame = useFrameCallback(tick, false);
  const handleLift = useCallback(() => {
    frame.setActive(true);
    onLift();
  }, [frame, onLift]);
  const handleDrop = useCallback(() => {
    frame.setActive(false);
    onDrop();
  }, [frame, onDrop]);

  // Crossing the divider fades the row the moment the order changes, before React catches up
  // with the subtitle.
  useAnimatedReaction(
    () => {
      const slots = order.value;
      const divider = geometry.dividerKey === null ? -1 : slots.indexOf(geometry.dividerKey);
      return divider !== -1 && slots.indexOf(itemKey) > divider;
    },
    (isExcluded, previous) => {
      if (previous === null || isExcluded === previous) return;
      dim.value = withTiming(isExcluded ? dimmedOpacity : 1, reduceMotion ? REDUCED_FADE : FADE);
    },
  );

  const gestures = useMemo(() => {
    const begin = (absoluteY: number, gesture: number) => {
      'worklet';
      if (active.value !== null) return;
      owner.value = gesture;
      cancelAnimation(y);
      active.value = itemKey;
      dragStartTop.value = y.value;
      dragTop.value = y.value;
      startAbsoluteY.value = absoluteY;
      touchAbsoluteY.value = absoluteY;

      if (scroll) {
        const viewport = measure(scroll.scrollRef);
        const list = measure(listRef);
        if (viewport && list) {
          listTopInViewport.value = list.pageY - viewport.pageY;
          viewportHeight.value = viewport.height;
        } else {
          viewportHeight.value = 0;
        }
        scrollStart.value = scroll.offset.value;
        scrollNow.value = scroll.offset.value;
        scrollSeen.value = scroll.offset.value;
        scroll.locked.value = true;
      }

      lift.value = withTiming(1, reduceMotion ? REDUCED_FADE : LIFT_IN);
      scheduleOnRN(handleLift);
    };

    const move = (absoluteY: number, gesture: number) => {
      'worklet';
      if (owner.value !== gesture) return;
      touchAbsoluteY.value = absoluteY;
      step(0, y);
    };

    const end = (gesture: number) => {
      'worklet';
      if (owner.value !== gesture) return;
      owner.value = NO_GESTURE;
      const target = topOf(order.value, itemKey, geometry);
      // Hand the row from the finger back to its own top without a jump, then settle it.
      y.value = dragTop.value;
      active.value = null;
      if (scroll) scroll.locked.value = false;
      lift.value = withTiming(0, reduceMotion ? REDUCED_FADE : LIFT_OUT);
      scheduleOnRN(handleDrop);

      // Committed at the drop, not once the row settles, so a Save or Back tapped during the settle
      // already has this move. The settle runs on the UI thread; React only re-ranks the rows.
      y.value = reduceMotion ? target : withSpring(target, SLIDE);
      commit();
    };

    const row = Gesture.Pan()
      .onStart(event => {
        'worklet';
        begin(event.absoluteY, ROW_GESTURE);
      })
      .onUpdate(event => {
        'worklet';
        move(event.absoluteY, ROW_GESTURE);
      })
      .onFinalize(() => {
        'worklet';
        end(ROW_GESTURE);
      });

    const handle = Gesture.Pan()
      .hitSlop(HANDLE_HIT_SLOP)
      .onStart(event => {
        'worklet';
        begin(event.absoluteY, HANDLE_GESTURE);
      })
      .onUpdate(event => {
        'worklet';
        move(event.absoluteY, HANDLE_GESTURE);
      })
      .onFinalize(() => {
        'worklet';
        end(HANDLE_GESTURE);
      });

    // On a touch screen the handle lifts the row after a short hold and anywhere else after a
    // longer one, so a swipe still scrolls the page; on a touch web page only the handle drags
    // (see WEB_TOUCH). A mouse drags from the handle at once and from anywhere else once it moves.
    if (IS_WEB && !WEB_TOUCH) {
      return {
        row: row.minDistance(WEB_MIN_DISTANCE),
        handle: handle.manualActivation(true).onTouchesDown((_event, manager) => {
          'worklet';
          manager.activate();
        }),
      };
    }
    return {
      row: WEB_TOUCH ? row.enabled(false) : row.activateAfterLongPress(LONG_PRESS_MS),
      handle: handle.activateAfterLongPress(HANDLE_HOLD_MS),
    };
  }, [
    active,
    commit,
    dragStartTop,
    dragTop,
    geometry,
    handleDrop,
    handleLift,
    itemKey,
    lift,
    listRef,
    listTopInViewport,
    order,
    owner,
    reduceMotion,
    scroll,
    scrollNow,
    scrollSeen,
    scrollStart,
    startAbsoluteY,
    step,
    touchAbsoluteY,
    viewportHeight,
    y,
  ]);

  // Reads `y`, never the shared `dragTop`, so only the lifted row's style runs per frame of a drag.
  const slotStyle = useAnimatedStyle(() => {
    const isActive = active.value === itemKey;
    const progress = lift.value;
    return {
      transform: [{ translateY: y.value }, { scale: reduceMotion ? 1 : 1 + LIFT_SCALE * progress }],
      // On top from the lift until it has settled back into the panel.
      zIndex: isActive || progress > 0.001 ? 10 : 0,
      backgroundColor: interpolateColor(progress, [0, 1], [RESTING_BACKGROUND, LIFTED_BACKGROUND]),
      shadowOpacity: LIFTED_SHADOW_OPACITY * progress,
      elevation: LIFTED_ELEVATION * progress,
    };
  });

  const contentStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  const state = useMemo<ReorderableItemState>(() => ({ rank, excluded }), [rank, excluded]);
  const actions = useMemo(
    () => [
      ...(upLabel ? [{ name: 'moveUp', label: upLabel }] : []),
      ...(downLabel ? [{ name: 'moveDown', label: downLabel }] : []),
    ],
    [downLabel, upLabel],
  );

  return (
    <GestureDetector gesture={gestures.row}>
      <Animated.View
        accessible
        accessibilityLabel={getAccessibilityLabel(itemKey, state)}
        accessibilityActions={actions}
        onAccessibilityAction={event => {
          const name = event.nativeEvent.actionName;
          if (name === 'moveUp') onMove(itemKey, -1);
          else if (name === 'moveDown') onMove(itemKey, 1);
        }}
        style={[styles.slot, styles.row, { height: geometry.itemHeight }, slotStyle]}
      >
        <Animated.View style={[styles.content, rowStyle, contentStyle]}>
          {renderItem(itemKey, state)}
          <GestureDetector gesture={gestures.handle}>
            <View accessible={false} style={styles.handle}>
              <DragHandleIcon />
            </View>
          </GestureDetector>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  // Figma 30971:15192: #2B2B2B, 20 round, the rows 6 in from the top and bottom. Not clipped, so a
  // lifted row's shadow and its 2% growth show past the edge.
  panel: {
    backgroundColor: '#2B2B2B',
    borderRadius: 20,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? { userSelect: 'none' as const } : null),
  },
  slot: { left: 0, position: 'absolute', right: 0, top: 0 },
  row: {
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0,
    shadowRadius: 16,
  },
  // Figma: 16 in from either side, 12 between the rank, logo, labels, figures and handle.
  content: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
  handle: { alignItems: 'center', height: 20, justifyContent: 'center', width: 20 },
});

export default ReorderableList;
