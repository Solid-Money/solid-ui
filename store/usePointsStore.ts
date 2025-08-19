import { fetchPoints } from '@/lib/api';
import mmkvStorage from '@/lib/mmvkStorage';
import { Points } from '@/lib/types';
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
        pointsLast24Hours: 0,
        userRewardsSummary: {
          totalPoints: 0,
          rewardsByType: [],
        },
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
          const points = await fetchPoints();
          set(
            produce(state => {
              state.points = points;
              state.isLoading = false;
            }),
          );
        } catch (error: any) {
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
      name: 'points-storage',
      storage: createJSONStorage(() => mmkvStorage('points-storage')),
    },
  ),
);
