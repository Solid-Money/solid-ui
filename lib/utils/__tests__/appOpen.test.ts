/// <reference types="jest" />
import {
  isBackgroundedState,
  isNewAppOpen,
  MIN_BACKGROUND_MS_FOR_NEW_OPEN,
  nextAppOpenState,
  shouldRecordAppOpen,
} from '@/lib/utils/appOpen';

const NOW = 1_800_000_000_000;

describe('isBackgroundedState', () => {
  it('treats background and inactive as away from the foreground', () => {
    expect(isBackgroundedState('background')).toBe(true);
    expect(isBackgroundedState('inactive')).toBe(true);
  });

  it('treats active as in the foreground', () => {
    expect(isBackgroundedState('active')).toBe(false);
  });
});

describe('isNewAppOpen', () => {
  it('is true once the app was away for the session gap', () => {
    expect(isNewAppOpen(NOW - MIN_BACKGROUND_MS_FOR_NEW_OPEN, NOW)).toBe(true);
    expect(isNewAppOpen(NOW - MIN_BACKGROUND_MS_FOR_NEW_OPEN * 3, NOW)).toBe(true);
  });

  it('is false for the brief detours native flows cause', () => {
    // Passkey sheet, biometrics, copying a code from another app.
    expect(isNewAppOpen(NOW - 2000, NOW)).toBe(false);
    expect(isNewAppOpen(NOW - MIN_BACKGROUND_MS_FOR_NEW_OPEN + 1, NOW)).toBe(false);
  });

  it('is false when the app was never seen leaving the foreground', () => {
    expect(isNewAppOpen(null, NOW)).toBe(false);
  });

  it('honours a custom gap', () => {
    expect(isNewAppOpen(NOW - 5000, NOW, 1000)).toBe(true);
    expect(isNewAppOpen(NOW - 500, NOW, 1000)).toBe(false);
  });
});

describe('shouldRecordAppOpen', () => {
  it('always records the first open', () => {
    expect(shouldRecordAppOpen(null, NOW)).toBe(true);
  });

  it('records again once a session gap has passed', () => {
    expect(shouldRecordAppOpen(NOW - MIN_BACKGROUND_MS_FOR_NEW_OPEN, NOW)).toBe(true);
  });

  it('drops a duplicate from a re-mount or an auth-state blip', () => {
    expect(shouldRecordAppOpen(NOW - 200, NOW)).toBe(false);
  });
});

describe('nextAppOpenState', () => {
  it('stamps the time the app left the foreground', () => {
    expect(
      nextAppOpenState({
        previousState: 'active',
        nextState: 'background',
        backgroundedAt: null,
        now: NOW,
      }),
    ).toEqual({ backgroundedAt: NOW, isNewOpen: false });
  });

  it('keeps the first timestamp across the inactive → background sequence', () => {
    const afterInactive = nextAppOpenState({
      previousState: 'active',
      nextState: 'inactive',
      backgroundedAt: null,
      now: NOW,
    });

    const afterBackground = nextAppOpenState({
      previousState: 'inactive',
      nextState: 'background',
      backgroundedAt: afterInactive.backgroundedAt,
      now: NOW + 1500,
    });

    expect(afterBackground).toEqual({ backgroundedAt: NOW, isNewOpen: false });
  });

  it('reports a new open when the app comes back after the session gap', () => {
    expect(
      nextAppOpenState({
        previousState: 'background',
        nextState: 'active',
        backgroundedAt: NOW - MIN_BACKGROUND_MS_FOR_NEW_OPEN,
        now: NOW,
      }),
    ).toEqual({ backgroundedAt: null, isNewOpen: true });
  });

  it('clears the timestamp without an open for a quick return', () => {
    expect(
      nextAppOpenState({
        previousState: 'inactive',
        nextState: 'active',
        backgroundedAt: NOW - 3000,
        now: NOW,
      }),
    ).toEqual({ backgroundedAt: null, isNewOpen: false });
  });

  it('ignores an active event that did not follow a background state', () => {
    expect(
      nextAppOpenState({
        previousState: 'active',
        nextState: 'active',
        backgroundedAt: null,
        now: NOW,
      }),
    ).toEqual({ backgroundedAt: null, isNewOpen: false });
  });

  it('leaves state untouched for unknown transitions', () => {
    expect(
      nextAppOpenState({
        previousState: 'background',
        nextState: 'unknown',
        backgroundedAt: NOW - 10_000,
        now: NOW,
      }),
    ).toEqual({ backgroundedAt: NOW - 10_000, isNewOpen: false });
  });

  it('does not report an open when the app was already in front at launch', () => {
    // Mount-time open is recorded explicitly; a foreground event without a
    // recorded background must not double-count it.
    expect(
      nextAppOpenState({
        previousState: 'inactive',
        nextState: 'active',
        backgroundedAt: null,
        now: NOW,
      }),
    ).toEqual({ backgroundedAt: null, isNewOpen: false });
  });
});
