import useUser from '@/hooks/useUser';
import { usePointsStore } from '@/store/usePointsStore';
import { useEffect } from 'react';

export const usePoints = () => {
  const { user } = useUser();
  const { points, isLoading, error, fetchPoints } = usePointsStore();

  useEffect(() => {
    // if (user && points.userRewardsSummary.totalPoints === 0) {
    fetchPoints();
    // }
  }, [user, points.userRewardsSummary.totalPoints, fetchPoints]);

  return {
    points,
    isLoading,
    error,
    refetch: fetchPoints,
  };
};
