import {
  autoScrollSpeed,
  heightOf,
  heightOfAll,
  moveSlot,
  REORDER_DIVIDER,
  reorderAt,
  sameSlots,
  type SlotGeometry,
  slotStates,
  topOf,
} from '@/components/Card/OrderList/reorder';

const D = REORDER_DIVIDER;
const geometry: SlotGeometry = { itemHeight: 64, dividerKey: D, dividerHeight: 40 };
const plain: SlotGeometry = { itemHeight: 64, dividerKey: null, dividerHeight: 0 };

describe('slot geometry', () => {
  const slots = ['A', 'B', D, 'C'];

  it('sizes rows and the divider', () => {
    expect(heightOf('A', geometry)).toBe(64);
    expect(heightOf(D, geometry)).toBe(40);
    // Without a divider every slot is a row.
    expect(heightOf(D, plain)).toBe(64);
  });

  it('places each slot under the ones above it', () => {
    expect(topOf(slots, 'A', geometry)).toBe(0);
    expect(topOf(slots, 'B', geometry)).toBe(64);
    expect(topOf(slots, D, geometry)).toBe(128);
    expect(topOf(slots, 'C', geometry)).toBe(168);
  });

  it('puts a slot that is not listed at the bottom', () => {
    expect(topOf(slots, 'Z', geometry)).toBe(232);
  });

  it('measures the whole list, the same in any order', () => {
    expect(heightOfAll(slots, geometry)).toBe(232);
    expect(heightOfAll([D, 'C', 'B', 'A'], geometry)).toBe(232);
    expect(heightOfAll([], geometry)).toBe(0);
  });
});

describe('sameSlots', () => {
  it('compares entry for entry', () => {
    expect(sameSlots(['A', 'B'], ['A', 'B'])).toBe(true);
    expect(sameSlots(['A', 'B'], ['B', 'A'])).toBe(false);
    expect(sameSlots(['A'], ['A', 'B'])).toBe(false);
  });
});

describe('reorderAt', () => {
  const slots = ['A', 'B', 'C', 'D'];
  // Without B, the others' places start at 0 (A), 64 (C) and 128 (D); B swaps with a neighbour
  // once its top passes halfway into it: 32, 96 and 160.

  it('leaves a row at rest where it is', () => {
    expect(reorderAt(slots, 'B', 64, plain)).toBe(slots);
    expect(reorderAt(slots, 'A', 0, plain)).toBe(slots);
    expect(reorderAt(slots, 'D', 192, plain)).toBe(slots);
  });

  it('returns the same array until the row is halfway into a neighbour', () => {
    expect(reorderAt(slots, 'B', 84, plain)).toBe(slots);
    expect(reorderAt(slots, 'B', 40, plain)).toBe(slots);
  });

  it('moves a row below the neighbour it is more than halfway into', () => {
    expect(reorderAt(slots, 'B', 97, plain)).toEqual(['A', 'C', 'B', 'D']);
  });

  it('moves a row up past a neighbour', () => {
    expect(reorderAt(slots, 'C', 31, plain)).toEqual(['C', 'A', 'B', 'D']);
  });

  it('jumps several places on a fast drag', () => {
    expect(reorderAt(slots, 'A', 170, plain)).toEqual(['B', 'C', 'D', 'A']);
    expect(reorderAt(slots, 'D', -50, plain)).toEqual(['D', 'A', 'B', 'C']);
  });

  it('crosses the divider halfway through the divider', () => {
    const withDivider = ['A', 'B', D, 'C'];
    // Without B, the divider sits at 64–104, its middle at 84.
    expect(reorderAt(withDivider, 'B', 83, geometry)).toBe(withDivider);
    expect(reorderAt(withDivider, 'B', 85, geometry)).toEqual(['A', D, 'B', 'C']);
    // And back up from below it, at the same line.
    const below = ['A', D, 'B', 'C'];
    expect(reorderAt(below, 'B', 85, geometry)).toBe(below);
    expect(reorderAt(below, 'B', 83, geometry)).toEqual(['A', 'B', D, 'C']);
  });

  it('holds a row resting within the hysteresis of the line', () => {
    expect(reorderAt(slots, 'B', 99, plain, 6)).toBe(slots);
    expect(reorderAt(slots, 'B', 103, plain, 6)).toEqual(['A', 'C', 'B', 'D']);
  });

  it('leaves the order alone for a key it does not hold', () => {
    expect(reorderAt(slots, 'Z', 0, plain)).toBe(slots);
  });

  it('keeps every key exactly once', () => {
    for (let top = -100; top < 400; top += 7) {
      const next = reorderAt(slots, 'B', top, plain, 6);
      expect([...next].sort()).toEqual(['A', 'B', 'C', 'D']);
    }
  });
});

describe('moveSlot', () => {
  it('swaps a row with its neighbour', () => {
    expect(moveSlot(['A', 'B', 'C'], 'B', -1)).toEqual(['B', 'A', 'C']);
    expect(moveSlot(['A', 'B', 'C'], 'B', 1)).toEqual(['A', 'C', 'B']);
  });

  it('does nothing past either end or for an unknown key, and never mutates', () => {
    const slots = ['A', 'B'];
    expect(moveSlot(slots, 'A', -1)).toEqual(['A', 'B']);
    expect(moveSlot(slots, 'B', 1)).toEqual(['A', 'B']);
    expect(moveSlot(slots, 'Z', 1)).toEqual(['A', 'B']);
    expect(slots).toEqual(['A', 'B']);
  });
});

describe('slotStates', () => {
  it('ranks the rows above the divider and dims the ones below', () => {
    const states = slotStates(['A', 'B', D, 'C'], D);

    expect(states.get('A')).toMatchObject({ rank: 1, excluded: false, canMoveUp: false });
    expect(states.get('B')).toMatchObject({
      rank: 2,
      excluded: false,
      downCrossesDivider: true,
      upCrossesDivider: false,
    });
    expect(states.get('C')).toMatchObject({
      rank: undefined,
      excluded: true,
      upCrossesDivider: true,
      canMoveDown: false,
    });
    expect(states.has(D)).toBe(false);
  });

  it('ranks every row in a list without a divider', () => {
    const states = slotStates(['A', 'B'], null);
    expect(states.get('B')).toMatchObject({ rank: 2, excluded: false, downCrossesDivider: false });
    expect(states.get('B')?.canMoveDown).toBe(false);
  });

  it('excludes everything when the divider is on top', () => {
    const states = slotStates([D, 'A', 'B'], D);
    expect(states.get('A')).toMatchObject({ rank: undefined, excluded: true });
    expect(states.get('B')).toMatchObject({ rank: undefined, excluded: true });
  });
});

describe('autoScrollSpeed', () => {
  const at = (top: number, canGoUp = true, canGoDown = true) =>
    autoScrollSpeed(top, top + 64, 600, 80, 14, canGoUp, canGoDown);

  it('stays still away from the edges', () => {
    expect(at(200)).toBe(0);
  });

  it('scrolls up near the top, faster the closer it gets', () => {
    expect(at(60)).toBeLessThan(0);
    expect(at(0)).toBe(-14);
    expect(Math.abs(at(-40))).toBe(14);
    expect(Math.abs(at(20))).toBeGreaterThan(Math.abs(at(60)));
  });

  it('scrolls down near the bottom', () => {
    // Bottom edge at 600 - 80 = 520; a row ending at 560 is halfway in.
    expect(at(496)).toBeGreaterThan(0);
    expect(at(536)).toBe(14);
  });

  it('does not run the page past the list', () => {
    expect(at(0, false)).toBe(0);
    expect(at(536, true, false)).toBe(0);
  });

  it('does nothing without a measured viewport', () => {
    expect(autoScrollSpeed(0, 64, 0, 80, 14, true, true)).toBe(0);
  });
});
