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
 * The account's push preferences, and a setter that applies a change at once,
 * puts it back if the save fails, and then reads back what the server holds.
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

  const mutationKey = [NOTIFICATION_PREFERENCES_QUERY_KEY, 'update', userId];

  // Two switches flipped in quick succession are two saves in flight. Each one
  // touches only its own switches, and the server's answer is read back once
  // the last save settles, so a late reply or a failed save can't flip back a
  // switch changed after it.
  const mutation = useMutation({
    mutationKey,
    mutationFn: (changes: Partial<NotificationPreferences>) =>
      withRefreshToken(() => updateNotificationPreferences(changes)),
    onMutate: async changes => {
      await queryClient.cancelQueries({ queryKey });
      const current = queryClient.getQueryData<NotificationPreferences | null>(queryKey);
      if (!current) return { reverted: undefined };
      const keys = Object.keys(changes) as (keyof NotificationPreferences)[];
      const reverted: Partial<NotificationPreferences> = Object.fromEntries(
        keys.map(key => [key, current[key]]),
      );
      queryClient.setQueryData(queryKey, { ...current, ...changes });
      return { reverted };
    },
    onError: (_error, _changes, context) => {
      if (!context?.reverted) return;
      queryClient.setQueryData<NotificationPreferences | null>(queryKey, current =>
        current ? { ...current, ...context.reverted } : current,
      );
    },
    onSettled: () => {
      // This save still counts as in flight, so 1 means it is the last one.
      if (queryClient.isMutating({ mutationKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey });
      }
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
