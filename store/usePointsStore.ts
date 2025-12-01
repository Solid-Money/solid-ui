import { fetchPoints } from '@/lib/api';
import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { Points } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import * as Sentry from '@sentry/react-native';
import { produce } from 'immer';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface PointsState {
  points: Points;
  isLoading: boolean;
  error: string | null;
  setPoints: (points: Points) => void;
  fetchPoints: () => Promise<void>;
}

export const usePointsStore = create<PointsState>()(
  persist(
    set => ({
      points: {
        nextRewardTime: 0,
        pointsLast24Hours: 0,
        userRewardsSummary: {
          totalPoints: 0,
          rewardsByType: [],
        },
        userRefferer: '',
      },
      isLoading: false,
      error: null,

      setPoints: (points: Points) => {
        set(
          produce(state => {
            state.points = points;
            state.error = null;
          }),
        );
      },

      fetchPoints: async () => {
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
    },
  ),
);
