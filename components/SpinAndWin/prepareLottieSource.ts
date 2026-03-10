/**
 * Utility to prepare a modified Lottie JSON source for the spin wheel animation.
 *
 * Strategy:
 *  1. Clone the base Lottie JSON once at module scope.
 *  2. Per-spin, clone again and patch the wheel rotation keyframes (inside a
 *     precomp asset) so the wheel lands on the correct segment for the given
 *     prize value.
 *  3. Derive playback timing from the same wheel rotation keyframes so the app
 *     stays aligned with the production animation file.
 */

import type { AnimationObject } from 'lottie-react-native';

interface LottieKeyframe {
  t: number;
  s: number[];
  h?: number;
  i?: Record<string, number | number[]>;
  o?: Record<string, number | number[]>;
}

interface LottieAnimatedProp {
  a: number;
  k: number | number[] | LottieKeyframe[];
}

interface LottieLayer {
  ind: number;
  ks: {
    o: LottieAnimatedProp;
    r: LottieAnimatedProp;
    p: LottieAnimatedProp;
    a: LottieAnimatedProp;
    s: LottieAnimatedProp;
  };
  [key: string]: unknown;
}

interface LottieAsset {
  id: string;
  layers?: LottieLayer[];
  [key: string]: unknown;
}

const WHEEL_ROTATION_ASSET_ID = '46';
const WHEEL_ROTATION_IND = 40;
const DEGREES_PER_SEGMENT = 360 / 7;
const BASE_ANGLE = 2148;

const SEGMENT_OFFSETS: Record<number, number> = {
  10000: 0,
  1000: 1,
  2000: 2,
  75: 3,
  750: -1,
  1500: -2,
  500: -3,
};

const rawLottie = require('@/assets/animations/spin.json');

function createBaseSource(): AnimationObject {
  return JSON.parse(JSON.stringify(rawLottie)) as AnimationObject;
}

const baseSource = createBaseSource();

function findWheelRotationLayer(source: AnimationObject): LottieLayer | undefined {
  const assets = (source as Record<string, unknown>).assets as LottieAsset[] | undefined;
  if (!assets) return undefined;

  const precomp = assets.find(asset => asset.id === WHEEL_ROTATION_ASSET_ID);
  if (!precomp?.layers) return undefined;

  return precomp.layers.find(layer => layer.ind === WHEEL_ROTATION_IND);
}

function getWheelRotationKeyframes(source: AnimationObject): LottieKeyframe[] {
  const wheelLayer = findWheelRotationLayer(source);
  const keyframes = wheelLayer?.ks.r.k;

  return Array.isArray(keyframes) ? (keyframes as LottieKeyframe[]) : [];
}

const wheelRotationKeyframes = getWheelRotationKeyframes(baseSource);

export function getTargetAngle(pointValue: number): number {
  const segmentOffset = SEGMENT_OFFSETS[pointValue] ?? 0;
  return BASE_ANGLE + segmentOffset * DEGREES_PER_SEGMENT;
}

export function prepareLottieSource(targetAngle: number): AnimationObject {
  const source = JSON.parse(JSON.stringify(baseSource)) as AnimationObject;
  const wheelLayer = findWheelRotationLayer(source);

  if (wheelLayer) {
    const keyframes = wheelLayer.ks.r.k as LottieKeyframe[];

    if (keyframes[2]) {
      keyframes[2].s = [targetAngle];
    }
    if (keyframes[3]) {
      keyframes[3].s = [targetAngle];
    }
  }

  return source;
}

export const ANIMATION_FPS = 60;
export const TARGET_PATCH_START_FRAME = Math.round(wheelRotationKeyframes[1]?.t ?? 127);
export const REVEAL_START_FRAME = Math.round(wheelRotationKeyframes[2]?.t ?? 422);
export const TARGETED_REVEAL_DELAY_MS =
  ((REVEAL_START_FRAME - TARGET_PATCH_START_FRAME) / ANIMATION_FPS) * 1000;
