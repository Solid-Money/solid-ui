import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { secondsToMilliseconds } from 'date-fns';

import useUser from '@/hooks/useUser';
import { fetchSpinStatus, performSpin } from '@/lib/api/spin-win';
import { isDevFeatureEnabled } from '@/lib/config';
import { withRefreshToken } from '@/lib/utils';
import { useSpinWinStore } from '@/store/useSpinWinStore';

const SPIN_WIN = 'spin-win';

export const useSpinStatus = () => {
  const { user } = useUser();
  const setSpinStatus = useSpinWinStore(state => state.setSpinStatus);

  return useQuery({
    queryKey: [SPIN_WIN, 'status', user?.userId],
    queryFn: async () => {
      const data = await withRefreshToken(() => fetchSpinStatus());
      if (data) {
        setSpinStatus(data);
      }
      return data;
    },
    // Spin & Win is an in-development feature: never query its status in
    // production so no game data reaches the client there.
    enabled: !!user?.userId && isDevFeatureEnabled,
    staleTime: secondsToMilliseconds(30),
    gcTime: secondsToMilliseconds(300),
  });
};

export const usePerformSpin = () => {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const setSpinResult = useSpinWinStore(state => state.setSpinResult);

  return useMutation({
    mutationKey: [SPIN_WIN, 'spin'],
    mutationFn: () => withRefreshToken(() => performSpin()),
    onSuccess: data => {
      if (data) {
        setSpinResult(data);
      }
      queryClient.invalidateQueries({ queryKey: [SPIN_WIN, 'status', user?.userId] });
    },
  });
};
