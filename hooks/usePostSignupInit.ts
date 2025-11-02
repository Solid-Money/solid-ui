import { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react-native';

import { updateSafeAddress } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { usePointsStore } from '@/store/usePointsStore';
import { User } from '@/lib/types';
import { fetchIsDeposited } from './useAnalytics';
import { useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '@/store/useUserStore';

/**
 * Hook to handle post-signup/post-login initialization tasks that don't need to block
 * the signup flow. This runs lazily after the user has been authenticated and navigated
 * to the main app.
 */
export const usePostSignupInit = (user: User | undefined) => {
  const queryClient = useQueryClient();
  const { updateUser } = useUserStore();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!user || hasInitialized.current) return;

    const initializeUser = async () => {
      try {
        // Mark as initialized immediately to prevent duplicate runs
        hasInitialized.current = true;

        // 1. Update safe address if needed (non-blocking failure)
        if (user.safeAddress) {
          try {
            await withRefreshToken(() => updateSafeAddress(user.safeAddress));
          } catch (error) {
            console.warn('Failed to update safe address:', error);
            Sentry.captureException(error, {
              tags: {
                type: 'safe_address_update_error_lazy',
              },
              user: {
                id: user.userId,
                address: user.safeAddress,
              },
              level: 'warning',
            });
          }
        }

        // 2. Check balance and update deposit status (non-blocking)
        try {
          const isDeposited = await fetchIsDeposited(queryClient, user.safeAddress);
          if (isDeposited && !user.isDeposited) {
            updateUser({
              ...user,
              isDeposited: true,
            });
          }
        } catch (error) {
          console.warn('Failed to check balance:', error);
          Sentry.captureException(error, {
            tags: {
              type: 'balance_check_error_lazy',
            },
            user: {
              id: user.userId,
              address: user.safeAddress,
            },
            level: 'warning',
          });
        }

        // 3. Fetch points (non-blocking)
        try {
          const { fetchPoints } = usePointsStore.getState();
          await fetchPoints();
        } catch (error) {
          console.warn('Failed to fetch points:', error);
          Sentry.captureException(error, {
            tags: {
              type: 'points_fetch_error_lazy',
            },
            user: {
              id: user.userId,
              address: user.safeAddress,
            },
            level: 'warning',
          });
        }
      } catch (error) {
        console.error('Error in post-signup initialization:', error);
        Sentry.captureException(error, {
          tags: {
            type: 'post_signup_init_error',
          },
          user: {
            id: user?.userId,
            address: user?.safeAddress,
          },
        });
      }
    };

    // Run initialization in background
    void initializeUser();
  }, [user, queryClient, updateUser]);

  // Reset flag when user changes
  useEffect(() => {
    hasInitialized.current = false;
  }, [user?.userId]);
};
