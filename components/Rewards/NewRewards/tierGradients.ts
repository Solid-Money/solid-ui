/**
 * Which way a rewards v3 wash runs.
 *
 * One rule, stated once, because three cards had drifted onto three diagonals:
 * a v3 gradient starts at the **top-right** corner, where the tint is, and ends
 * **bottom-left**, where it goes black.
 *
 * The "Join … Club" banner is the deliberate exception and runs the other
 * diagonal — bottom-right to top-left — which puts its heading on the dark
 * corner and the tint under the benefit chips.
 *
 * Spread these into `LinearGradient` rather than writing the points inline:
 * `start={{ x: 1, y: 0 }}` and `start={{ x: 0, y: 0 }}` differ by one character
 * and by ninety degrees, which is exactly how the upgrade card ended up lit
 * from the wrong side.
 */
export const TOP_RIGHT_WASH = {
  start: { x: 1, y: 0 },
  end: { x: 0, y: 1 },
} as const;

/** The "Join … Club" banner's exception: bottom-right to top-left. */
export const BOTTOM_RIGHT_WASH = {
  start: { x: 1, y: 1 },
  end: { x: 0, y: 0 },
} as const;
