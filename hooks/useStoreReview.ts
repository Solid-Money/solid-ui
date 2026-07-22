import { useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { useStoreReviewStore } from '@/store/useStoreReviewStore';

// Minimum time between two native review prompts. The OS enforces its own quota
// (iOS shows the sheet at most a few times a year; Android is quota-limited too),
// but we add a generous cooldown so we never nag a user who keeps earning cashback.
const REVIEW_REQUEST_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 120; // 120 days

interface RequestReviewOptions {
  /** Free-form context for analytics, e.g. what triggered the prompt. */
  trigger?: string;
  [key: string]: unknown;
}

/**
 * Thin wrapper around expo-store-review that asks for an in-app rating without
 * leaving the app. All Apple/Google guidance around *when* to prompt lives in the
 * caller — this hook only owns availability checks, cooldown, foreground guard,
 * and analytics. It never opens the store listing (that would leave the app),
 * so it no-ops whenever the native in-app prompt isn't available.
 */
export const useStoreReview = () => {
  const requestReview = useCallback(async (options: RequestReviewOptions = {}) => {
    // The native in-app prompt only exists on iOS/Android.
    if (Platform.OS === 'web') return;

    const { lastReviewRequestAt } = useStoreReviewStore.getState();

    // Respect our own cooldown before touching the SDK.
    if (lastReviewRequestAt && Date.now() - lastReviewRequestAt < REVIEW_REQUEST_COOLDOWN_MS) {
      track(TRACKING_EVENTS.STORE_REVIEW_SKIPPED, { reason: 'cooldown', ...options });
      return;
    }

    // Don't surface the sheet while the app is backgrounded/transitioning.
    if (AppState.currentState !== 'active') {
      track(TRACKING_EVENTS.STORE_REVIEW_SKIPPED, { reason: 'not_active', ...options });
      return;
    }

    try {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (!isAvailable) {
        track(TRACKING_EVENTS.STORE_REVIEW_UNAVAILABLE, { reason: 'not_available', ...options });
        return;
      }

      // Re-check foreground state after the async availability call.
      if (AppState.currentState !== 'active') {
        track(TRACKING_EVENTS.STORE_REVIEW_SKIPPED, { reason: 'not_active', ...options });
        return;
      }

      await StoreReview.requestReview();
      useStoreReviewStore.getState().recordReviewRequest(Date.now());
      track(TRACKING_EVENTS.STORE_REVIEW_REQUESTED, options);
    } catch (error) {
      track(TRACKING_EVENTS.STORE_REVIEW_ERROR, {
        message: error instanceof Error ? error.message : String(error),
        ...options,
      });
    }
  }, []);

  return { requestReview };
};
