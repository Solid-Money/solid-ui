import { useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { useStoreReviewStore } from '@/store/useStoreReviewStore';

// Default minimum time between two native review prompts. The OS enforces its
// own quota (iOS shows the sheet at most a few times a year; Android is
// quota-limited too), but we add a generous cooldown so we never nag a user who
// keeps earning cashback. Triggers with their own server-side gating can pass a
// shorter `cooldownMs`.
export const DEFAULT_REVIEW_REQUEST_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 120; // 120 days

interface RequestReviewOptions {
  /** Free-form context for analytics, e.g. what triggered the prompt. */
  trigger?: string;
  /**
   * Overrides the local cooldown for this call. Use it when the trigger already
   * enforces its own (e.g. server-side) spacing and the default 120 days would
   * suppress a prompt that should be allowed.
   */
  cooldownMs?: number;
  [key: string]: unknown;
}

/**
 * Thin wrapper around expo-store-review that asks for an in-app rating without
 * leaving the app. All Apple/Google guidance around *when* to prompt lives in the
 * caller — this hook only owns availability checks, cooldown, foreground guard,
 * and analytics. It never opens the store listing (that would leave the app),
 * so it no-ops whenever the native in-app prompt isn't available.
 *
 * Resolves to true only when the native sheet was actually requested, so callers
 * can record the prompt (locally or server-side) without guessing.
 */
export const useStoreReview = () => {
  const requestReview = useCallback(
    async (options: RequestReviewOptions = {}): Promise<boolean> => {
      const { cooldownMs = DEFAULT_REVIEW_REQUEST_COOLDOWN_MS, ...context } = options;

      // The native in-app prompt only exists on iOS/Android.
      if (Platform.OS === 'web') return false;

      const { lastReviewRequestAt } = useStoreReviewStore.getState();

      // Respect our own cooldown before touching the SDK.
      if (lastReviewRequestAt && Date.now() - lastReviewRequestAt < cooldownMs) {
        track(TRACKING_EVENTS.STORE_REVIEW_SKIPPED, { reason: 'cooldown', ...context });
        return false;
      }

      // Don't surface the sheet while the app is backgrounded/transitioning.
      if (AppState.currentState !== 'active') {
        track(TRACKING_EVENTS.STORE_REVIEW_SKIPPED, { reason: 'not_active', ...context });
        return false;
      }

      try {
        const isAvailable = await StoreReview.isAvailableAsync();
        if (!isAvailable) {
          track(TRACKING_EVENTS.STORE_REVIEW_UNAVAILABLE, { reason: 'not_available', ...context });
          return false;
        }

        // Re-check foreground state after the async availability call.
        if (AppState.currentState !== 'active') {
          track(TRACKING_EVENTS.STORE_REVIEW_SKIPPED, { reason: 'not_active', ...context });
          return false;
        }

        await StoreReview.requestReview();
        useStoreReviewStore.getState().recordReviewRequest(Date.now());
        track(TRACKING_EVENTS.STORE_REVIEW_REQUESTED, context);
        return true;
      } catch (error) {
        track(TRACKING_EVENTS.STORE_REVIEW_ERROR, {
          message: error instanceof Error ? error.message : String(error),
          ...context,
        });
        return false;
      }
    },
    [],
  );

  return { requestReview };
};
