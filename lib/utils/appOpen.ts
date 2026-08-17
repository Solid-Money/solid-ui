import type { AppStateStatus } from 'react-native';

/**
 * How long the app has to stay backgrounded before coming back counts as a new
 * "app open" rather than a continuation of the same session.
 *
 * Native flows bounce the app through `inactive`/`background` constantly —
 * passkey and biometric sheets, the OS share sheet, copying a code from another
 * app — and none of those are the user opening the app. Five minutes is the
 * usual session cut-off, and keeping it here means brief detours neither inflate
 * the open count nor spend an app-open request.
 */
export const MIN_BACKGROUND_MS_FOR_NEW_OPEN = 5 * 60 * 1000;

/** True for the states that mean the app is no longer in front of the user. */
export const isBackgroundedState = (state: AppStateStatus): boolean =>
  state === 'background' || state === 'inactive';

/**
 * True when a return to the foreground should be recorded as a fresh app open.
 * `backgroundedAt` is epoch ms of when the app left the foreground, or null if
 * we never saw it leave (in which case there is nothing new to record).
 */
export const isNewAppOpen = (
  backgroundedAt: number | null,
  now: number,
  minBackgroundMs: number = MIN_BACKGROUND_MS_FOR_NEW_OPEN,
): boolean => {
  if (backgroundedAt === null) return false;
  return now - backgroundedAt >= minBackgroundMs;
};

/**
 * True when an open should be reported given when we last reported one.
 * `lastRecordedAt` is null before the first report, which always counts.
 *
 * Note the deliberate asymmetry with {@link isNewAppOpen}: there, null means the
 * app was never seen leaving the foreground, so there is nothing new to record.
 */
export const shouldRecordAppOpen = (
  lastRecordedAt: number | null,
  now: number,
  minGapMs: number = MIN_BACKGROUND_MS_FOR_NEW_OPEN,
): boolean => {
  if (lastRecordedAt === null) return true;
  return now - lastRecordedAt >= minGapMs;
};

export interface AppOpenTransitionInput {
  previousState: AppStateStatus;
  nextState: AppStateStatus;
  /** Epoch ms of when the app left the foreground; null while it is in front. */
  backgroundedAt: number | null;
  now: number;
  minBackgroundMs?: number;
}

export interface AppOpenTransition {
  /** Value to carry into the next transition. */
  backgroundedAt: number | null;
  /** True when this transition is a fresh app open worth recording. */
  isNewOpen: boolean;
}

/**
 * Fold one `AppState` change into the app-open tracking state.
 *
 * Kept as a pure function because the interesting part is the sequencing: iOS
 * emits `active → inactive → background` on the way out and
 * `background → inactive → active` on the way back, so only the *first*
 * background timestamp may be kept (otherwise the clock restarts on the way
 * out) and only a transition that ends in `active` can be an open.
 */
export const nextAppOpenState = ({
  previousState,
  nextState,
  backgroundedAt,
  now,
  minBackgroundMs,
}: AppOpenTransitionInput): AppOpenTransition => {
  if (isBackgroundedState(nextState)) {
    return { backgroundedAt: backgroundedAt ?? now, isNewOpen: false };
  }

  // Only a background/inactive → active transition can be a new open.
  if (nextState !== 'active' || !isBackgroundedState(previousState)) {
    return { backgroundedAt, isNewOpen: false };
  }

  return {
    backgroundedAt: null,
    isNewOpen: isNewAppOpen(backgroundedAt, now, minBackgroundMs),
  };
};
