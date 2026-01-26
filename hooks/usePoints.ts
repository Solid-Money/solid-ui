import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import useUser from '@/hooks/useUser';
import { usePointsStore } from '@/store/usePointsStore';

export const usePoints = () => {
  const { user } = useUser();
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { points, isLoading, error, fetchPoints } = usePointsStore(
    useShallow(state => ({
      points: state.points,
      isLoading: state.isLoading,
      error: state.error,
      fetchPoints: state.fetchPoints,
    })),
  );

  useEffect(() => {
    if (user) {
      // Call directly from store state to avoid dependency on potentially
      // unstable function reference during Zustand hydration
      usePointsStore.getState().fetchPoints();
    }
  }, [user?.userId]);

  return {
    points,
    isLoading,
    error,
    refetch: fetchPoints,
  };
};
