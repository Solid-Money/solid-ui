/**
 * Utility to prepare a modified Lottie JSON source for the spin wheel animation.
 *
 * Strategy (C3 Hybrid):
 *  1. Clone the base Lottie JSON once at module scope.
 *  2. Hide the hardcoded "+1,000" reveal layers by zeroing their opacity.
 *  3. Per-spin, clone again and patch the wheel rotation keyframes so the
 *     wheel lands on the correct segment for the given prize value.
 *  4. The component renders a React Native animated text overlay timed to
 *     appear when the reveal would have shown (handled in the component).
 */

import type { AnimationObject } from 'lottie-react-native';

// ---------------------------------------------------------------------------
// Types – internal subset of the Lottie layer structure we mutate
// ---------------------------------------------------------------------------

interface LottieKeyframe {
  t: number; // time (frame)
  s: number[]; // start value
  h?: number; // hold
  i?: Record<string, number | number[]>;
  o?: Record<string, number | number[]>;
}

interface LottieAnimatedProp {
  a: number; // 0 = static, 1 = animated
  k: number | number[] | LottieKeyframe[];
}

interface LottieLayer {
  ind: number;
  ks: {
    o: LottieAnimatedProp; // opacity
    r: LottieAnimatedProp; // rotation
    p: LottieAnimatedProp; // position
    a: LottieAnimatedProp; // anchor
    s: LottieAnimatedProp; // scale
  };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Layer `ind` values for the "+1,000" reveal shapes. */
const REVEAL_LAYER_INDS = [3390, 3395, 3400, 3405, 3410, 3415];

/** Layer `ind` for the wheel rotation null-object. */
const WHEEL_ROTATION_IND = 3490;

/** Degrees per segment (360 / 7 segments). */
const DEGREES_PER_SEGMENT = 360 / 7; // ~51.4286

/**
 * The base landing angle baked into the original animation.
 * Keyframes[2] and [3] both have s[0] = -495.
 */
const BASE_ANGLE = -495;

/**
 * Mapping from point value to a segment offset (number of segments to shift
 * from the base position).
 *
 * The base angle (-495 deg) lands on a specific segment. By adding multiples
 * of DEGREES_PER_SEGMENT we rotate to adjacent segments. Negative offsets
 * move clockwise (since the rotation values are negative / clockwise).
 *
 * These offsets were derived from the visual layout of the 7-segment wheel:
 *   Segment 0 (base, -495):  +1,000
 *   Segment 1 (-495 - 51.4): +100   (one segment clockwise)
 *   Segment 2 (-495 - 102.9): +7,000 (two segments clockwise)
 *   Segment 3 (-495 - 154.3): +100   (three segments clockwise)
 *   Segment 4 (-495 - 205.7): +1,000 (four segments clockwise)
 *   Segment 5 (-495 - 257.1): +100   (five segments clockwise)
 *   Segment 6 (-495 - 308.6): +100   (six segments clockwise)
 *
 * Since there are multiple segments with the same value, we pick one for each
 * unique prize tier.
 */
const SEGMENT_OFFSETS: Record<number, number> = {
  1000: 0, // stays at base angle
  100: -1, // one segment clockwise
  7000: -2, // two segments clockwise
};

// ---------------------------------------------------------------------------
// Module-level base clone (created once)
// ---------------------------------------------------------------------------

const rawLottie = require('@/assets/animations/spin-wheel.json');

/**
 * Deep-clone the original JSON once and zero-out the reveal layer opacities
 * so the hardcoded "+1,000" text never shows.
 *
 * The new wheel-only animation (spin-wheel.json) has the reveal layers removed,
 * but this logic is kept defensive so it handles both old and new assets.
 */
function createBaseSource(): AnimationObject {
  const clone = JSON.parse(JSON.stringify(rawLottie)) as AnimationObject;

  const layers = clone.layers as LottieLayer[] | undefined;
  if (layers) {
    REVEAL_LAYER_INDS.forEach(ind => {
      const layer = layers.find(l => l.ind === ind);
      if (layer?.ks?.o) {
        // Replace animated opacity with a static 0 (fully transparent)
        layer.ks.o = { a: 0, k: 0 };
      }
    });
  }

  return clone;
}

const baseSource = createBaseSource();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Given a prize point value, return the target wheel rotation angle.
 */
export function getTargetAngle(pointValue: number): number {
  const segmentOffset = SEGMENT_OFFSETS[pointValue] ?? 0;
  return BASE_ANGLE + segmentOffset * DEGREES_PER_SEGMENT;
}

/**
 * Prepare a Lottie JSON object with:
 *  - "+1,000" reveal layers hidden (opacity = 0)
 *  - Wheel rotation adjusted so it lands on the segment for `targetAngle`
 *
 * @param targetAngle - The final rotation angle (from `getTargetAngle`)
 * @returns A modified Lottie JSON object ready to pass to LottieView's `source` prop
 */
export function prepareLottieSource(targetAngle: number): AnimationObject {
  // Deep-clone the pre-processed base
  const source = JSON.parse(JSON.stringify(baseSource)) as AnimationObject;

  const layers = source.layers as LottieLayer[];

  // Find the wheel rotation layer
  const wheelLayer = layers.find(l => l.ind === WHEEL_ROTATION_IND);

  if (wheelLayer) {
    const keyframes = wheelLayer.ks.r.k as LottieKeyframe[];
    // Keyframe[2] = frame 78.6 (landed position)
    // Keyframe[3] = frame 240 (hold until end)
    if (keyframes[2]) {
      keyframes[2].s = [targetAngle];
    }
    if (keyframes[3]) {
      keyframes[3].s = [targetAngle];
    }
  }

  return source;
}

/**
 * Frame at which the reveal text starts becoming visible in the original
 * animation (~108 frames at 60fps = 1.8 seconds).
 */
export const REVEAL_START_FRAME = 108;

/** Animation framerate. */
export const ANIMATION_FPS = 60;

/** Delay in ms before showing the prize overlay (matches reveal timing). */
export const PRIZE_REVEAL_DELAY_MS = (REVEAL_START_FRAME / ANIMATION_FPS) * 1000;
