/**
 * The pure geometry behind {@link ReorderableList}: where each slot sits, where a dragged row
 * belongs, and what a move does to the order.
 *
 * Every function that runs during a drag is a worklet, so the list can call it on the UI thread
 * each frame without a hop to JavaScript. No imports, so the functions stay plain to unit-test.
 */

/** The default key of the divider slot, the one non-draggable entry in a list's order. */
export const REORDER_DIVIDER = '__divider__';

/** The fixed heights a list lays its slots out with. */
export interface SlotGeometry {
  /** Every draggable row's height. */
  itemHeight: number;
  /** The divider's key, or null for a list without one. */
  dividerKey: string | null;
  /** The divider's height; ignored without a divider. */
  dividerHeight: number;
}

/** One slot's height. */
export const heightOf = (slot: string, geometry: SlotGeometry): number => {
  'worklet';
  return slot === geometry.dividerKey ? geometry.dividerHeight : geometry.itemHeight;
};

/** Where `slot` starts, from the top of the list; the list's height if it is not in `slots`. */
export const topOf = (slots: readonly string[], slot: string, geometry: SlotGeometry): number => {
  'worklet';
  let top = 0;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === slot) return top;
    top += heightOf(slots[i], geometry);
  }
  return top;
};

/** The list's full height. The same in any order, so it never changes during a drag. */
export const heightOfAll = (slots: readonly string[], geometry: SlotGeometry): number => {
  'worklet';
  let total = 0;
  for (let i = 0; i < slots.length; i++) total += heightOf(slots[i], geometry);
  return total;
};

/** Whether two orders are the same, entry for entry. */
export const sameSlots = (a: readonly string[], b: readonly string[]): boolean => {
  'worklet';
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/**
 * Where among `others` (the order without the dragged row) a row whose top is at `rowTop` belongs:
 * the place whose resting top is nearest. Placed in front of `others[i]` its top would be `start`,
 * and behind it `start + height`, so the line between the two is the neighbour's midpoint. Measured
 * from the row's top rather than its centre so a row at rest stays where it is, and a row crosses
 * the shorter divider after half the divider's height, either way.
 */
const insertionIndex = (
  others: readonly string[],
  rowTop: number,
  geometry: SlotGeometry,
): number => {
  'worklet';
  let start = 0;
  for (let i = 0; i < others.length; i++) {
    const height = heightOf(others[i], geometry);
    if (rowTop < start + height / 2) return i;
    start += height;
  }
  return others.length;
};

/**
 * `slots` with `slot` moved to wherever a row whose top is at `rowTop` now belongs.
 *
 * A move needs the row `hysteresis` points past the line, so a finger resting on
 * the line between two rows does not swap them back and forth (and buzz a haptic each time).
 * Returns `slots` itself when nothing moves, so the caller can compare by reference.
 */
export const reorderAt = (
  slots: readonly string[],
  slot: string,
  rowTop: number,
  geometry: SlotGeometry,
  hysteresis = 0,
): readonly string[] => {
  'worklet';
  const current = slots.indexOf(slot);
  if (current === -1) return slots;
  const others: string[] = [];
  for (let i = 0; i < slots.length; i++) if (slots[i] !== slot) others.push(slots[i]);

  let index = insertionIndex(others, rowTop, geometry);
  if (index === current) return slots;
  if (hysteresis > 0) {
    // Pulled back toward where it was: if that would keep it in place, it has not cleared the line.
    const back = insertionIndex(
      others,
      rowTop + (index > current ? -hysteresis : hysteresis),
      geometry,
    );
    if (back === current) return slots;
    index = back;
  }

  const next: string[] = [];
  for (let i = 0; i < others.length; i++) {
    if (i === index) next.push(slot);
    next.push(others[i]);
  }
  if (index >= others.length) next.push(slot);
  return next;
};

/** `slots` with `key` swapped one place up (-1) or down (1) — across the divider included. */
export const moveSlot = (slots: readonly string[], key: string, delta: -1 | 1): string[] => {
  const from = slots.indexOf(key);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= slots.length) return [...slots];
  const next = [...slots];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
};

/** What a row shows of its place in the order. */
export interface SlotState {
  /** 1 for the top row; undefined below the divider, where a row has no rank. */
  rank: number | undefined;
  /** Below the divider. */
  excluded: boolean;
  /** Its index in the full order, the divider counted. */
  index: number;
  /** Whether a Move up / Move down would do anything. */
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** The move crosses the divider: up from just below it, down from just above it. */
  upCrossesDivider: boolean;
  downCrossesDivider: boolean;
}

/** Every row's {@link SlotState}, by key. */
export const slotStates = (
  slots: readonly string[],
  dividerKey: string | null,
): Map<string, SlotState> => {
  const divider = dividerKey === null ? -1 : slots.indexOf(dividerKey);
  const states = new Map<string, SlotState>();
  for (const [index, key] of slots.entries()) {
    if (key === dividerKey) continue;
    const excluded = divider !== -1 && index > divider;
    states.set(key, {
      rank: excluded ? undefined : index + 1,
      excluded,
      index,
      canMoveUp: index > 0,
      canMoveDown: index < slots.length - 1,
      upCrossesDivider: divider !== -1 && index === divider + 1,
      downCrossesDivider: divider !== -1 && index === divider - 1,
    });
  }
  return states;
};

/**
 * How fast to auto-scroll, in points per 60 Hz frame, for a lifted row at `rowTop`–`rowBottom` in a
 * viewport `viewportHeight` tall: faster the deeper it sits in the `edge`-point band at either end,
 * up to `maxSpeed`. Negative scrolls up. Zero when the row cannot move further that way anyway
 * (`canGoUp` / `canGoDown`), so the page does not run on past the list.
 */
export const autoScrollSpeed = (
  rowTop: number,
  rowBottom: number,
  viewportHeight: number,
  edge: number,
  maxSpeed: number,
  canGoUp: boolean,
  canGoDown: boolean,
): number => {
  'worklet';
  if (viewportHeight <= 0 || edge <= 0) return 0;
  if (canGoUp && rowTop < edge) {
    const depth = Math.min(1, (edge - rowTop) / edge);
    return -maxSpeed * depth * depth;
  }
  if (canGoDown && rowBottom > viewportHeight - edge) {
    const depth = Math.min(1, (rowBottom - (viewportHeight - edge)) / edge);
    return maxSpeed * depth * depth;
  }
  return 0;
};
