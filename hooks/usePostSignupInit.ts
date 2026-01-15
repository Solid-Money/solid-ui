import * as Sentry from '@sentry/react-native';
import { useEffect, useRef } from 'react';

import { User } from '@/lib/types';
import { usePointsStore } from '@/store/usePointsStore';
import { useUserStore } from '@/store/useUserStore';
import { useQueryClient } from '@tanstack/react-query';
import { fetchIsDeposited } from './useAnalytics';

/**
 * Hook to handle post-signup/post-login initialization tasks that don't need to block
 * the signup flow. This runs lazily after the user has been authenticated and navigated
 * to the main app.
 */
export const usePostSignupInit = (user: User | undefined) => {
  const queryClient = useQueryClient();
  const hasInitialized = useRef(false);
  const lastUserId = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Only run when we have a new user (different userId)
    if (!user || user.userId === lastUserId.current) return;

    // Set immediately to prevent race condition with async updates
    lastUserId.current = user.userId;

    const initializeUser = async () => {
      try {
        // Mark as initialized immediately to prevent duplicate runs
        hasInitialized.current = true;
        // Check balance and update deposit status (non-blocking)
        try {
          const isDeposited = await fetchIsDeposited(queryClient, user.safeAddress);
          if (isDeposited && !user.isDeposited) {
            useUserStore.getState().updateUser({
              ...user,
              isDeposited: true,
            });
          }
        } catch (error) {
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

        // Fetch points (non-blocking)
        try {
          const { fetchPoints } = usePointsStore.getState();
          await fetchPoints();
        } catch (error) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]); // Only depend on userId, not the entire user object or queryClient
};
