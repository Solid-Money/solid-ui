import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

/**
 * Persisted bookkeeping for the in-app store review prompt.
 *
 * The prompt is only ever shown after a user *receives* soUSD cashback, so we
 * track which cashback payouts we've already accounted for. `hasCapturedBaseline`
 * lets us distinguish a brand-new payout (prompt-worthy) from cashback that
 * already existed the first time this device saw the feature (not prompt-worthy).
 */
interface StoreReviewState {
  /** True once we've recorded the set of payouts that pre-dated this feature on this device. */
  hasCapturedBaseline: boolean;
  /** Cashback ids already observed as received, so we never prompt twice for the same payout. */
  reviewedCashbackIds: string[];
  /** Epoch ms of the last time we actually invoked the native review prompt. */
  lastReviewRequestAt: number | null;
  /** How many times we've invoked the native review prompt (for diagnostics). */
  reviewRequestCount: number;
  captureBaseline: (ids: string[]) => void;
  markSeen: (ids: string[]) => void;
  recordReviewRequest: (at: number) => void;
  reset: () => void;
}

const STORE_REVIEW_STORAGE_KEY = 'store-review-storage';

// Cap how many ids we retain so MMKV storage can't grow unbounded for heavy card
// users. The cashback API only returns a recent window, so keeping the most
// recent ids is enough to detect genuinely new payouts.
const MAX_TRACKED_IDS = 500;

const uniqueRecent = (ids: string[]): string[] => Array.from(new Set(ids)).slice(-MAX_TRACKED_IDS);

export const useStoreReviewStore = create<StoreReviewState>()(
  persist(
    set => ({
      hasCapturedBaseline: false,
      reviewedCashbackIds: [],
      lastReviewRequestAt: null,
      reviewRequestCount: 0,
      captureBaseline: (ids: string[]) =>
        set({ hasCapturedBaseline: true, reviewedCashbackIds: uniqueRecent(ids) }),
      markSeen: (ids: string[]) =>
        set(state => ({
          reviewedCashbackIds: uniqueRecent([...state.reviewedCashbackIds, ...ids]),
        })),
      recordReviewRequest: (at: number) =>
        set(state => ({
          lastReviewRequestAt: at,
          reviewRequestCount: state.reviewRequestCount + 1,
        })),
      reset: () =>
        set({
          hasCapturedBaseline: false,
          reviewedCashbackIds: [],
          lastReviewRequestAt: null,
          reviewRequestCount: 0,
        }),
    }),
    {
      name: STORE_REVIEW_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(STORE_REVIEW_STORAGE_KEY)),
    },
  ),
);
