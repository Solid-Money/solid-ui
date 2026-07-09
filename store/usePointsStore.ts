import * as Sentry from '@sentry/react-native';
import { produce } from 'immer';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { fetchPoints } from '@/lib/api';
import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { Points } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

interface PointsState {
  points: Points;
  isLoading: boolean;
  error: string | null;
  lastFetchTime: number | null;
  setPoints: (points: Points) => void;
  fetchPoints: (options?: { force?: boolean }) => Promise<void>;
  reset: () => void;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION_MS = 5 * 60 * 1000;

// Empty points, used for the initial state and when resetting on account switch.
const INITIAL_POINTS: Points = {
  nextRewardTime: 0,
  pointsLast24Hours: 0,
  userRewardsSummary: {
    totalPoints: 0,
    rewardsByType: [],
  },
  userRefferer: '',
  leaderboardPosition: 0,
};

export const usePointsStore = create<PointsState>()(
  persist(
    (set, get) => ({
      points: INITIAL_POINTS,
      isLoading: false,
      error: null,
      lastFetchTime: null,

      setPoints: (points: Points) => {
        set(
          produce(state => {
            state.points = points;
            state.error = null;
          }),
        );
      },

      // Wipe all points state on logout / account switch so a new account never
      // sees the previous user's points. Clearing lastFetchTime also disables
      // the 5-minute fetch-skip so the next fetchPoints() actually runs.
      reset: () => {
        set({
          points: INITIAL_POINTS,
          isLoading: false,
          error: null,
          lastFetchTime: null,
        });
      },

      fetchPoints: async (options?: { force?: boolean }) => {
        const { lastFetchTime, isLoading } = get();
        const now = Date.now();

        // Skip if already loading
        if (isLoading) return;

        // Skip if data was fetched recently (unless forced)
        if (!options?.force && lastFetchTime && now - lastFetchTime < CACHE_DURATION_MS) {
          return;
        }

        set(
          produce(state => {
            state.isLoading = true;
            state.error = null;
          }),
        );

        try {
          const points = await withRefreshToken(() => fetchPoints());
          set(
            produce(state => {
              state.points = points;
              state.isLoading = false;
              state.lastFetchTime = Date.now();
            }),
          );
        } catch (error: any) {
          console.error('Failed to fetch points:', error);
          Sentry.captureException(error, {
            tags: {
              type: 'points_fetch_store_error',
            },
            extra: {
              errorMessage: error.message,
            },
          });
          set(
            produce(state => {
              state.error = error.message || 'Failed to fetch points';
              state.isLoading = false;
            }),
          );
        }
      },
    }),
    {
      name: USER.pointsStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.pointsStorageKey)),
      partialize: state => ({
        points: state.points,
        // Don't persist lastFetchTime - we want fresh data on app restart
      }),
    },
  ),
);
