import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getNotificationPreferences,
  NotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

export const NOTIFICATION_PREFERENCES_QUERY_KEY = 'notificationPreferences';

const useSelectedUserId = () =>
  useUserStore(state => state.users.find(user => user.selected)?.userId);

/**
 * The account's push preferences, and a setter that applies a change at once
 * and puts it back if the save fails.
 *
 * `preferences` is null when the backend has no preferences endpoint, which
 * the Notifications screen takes as "leave the categories out".
 */
export const useNotificationPreferences = () => {
  const userId = useSelectedUserId();
  const queryClient = useQueryClient();
  const queryKey = [NOTIFICATION_PREFERENCES_QUERY_KEY, userId];

  const query = useQuery({
    queryKey,
    queryFn: () => withRefreshToken(() => getNotificationPreferences()),
    enabled: !!userId,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: (changes: Partial<NotificationPreferences>) =>
      withRefreshToken(() => updateNotificationPreferences(changes)),
    onMutate: async changes => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationPreferences | null>(queryKey);
      if (previous) queryClient.setQueryData(queryKey, { ...previous, ...changes });
      return { previous };
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: saved => {
      queryClient.setQueryData(queryKey, saved);
    },
  });

  return {
    preferences: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    update: mutation.mutate,
    isSaveError: mutation.isError,
  };
};

export default useNotificationPreferences;
