import * as Sentry from '@sentry/react-native';
import { useEffect, useRef } from 'react';

import { updateSafeAddress } from '@/lib/api';
import { User } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { usePointsStore } from '@/store/usePointsStore';
import { useUserStore } from '@/store/useUserStore';
import { useQueryClient } from '@tanstack/react-query';
import { fetchIsDeposited } from './useAnalytics';
import { useShallow } from 'zustand/react/shallow';

/**
 * Hook to handle post-signup/post-login initialization tasks that don't need to block
 * the signup flow. This runs lazily after the user has been authenticated and navigated
 * to the main app.
 */
export const usePostSignupInit = (user: User | undefined) => {
  const queryClient = useQueryClient();
  const hasInitialized = useRef(false);
  const lastUserId = useRef<string | undefined>(undefined);
  const { safeAddressSynced, markSafeAddressSynced } = useUserStore(
    useShallow(state => ({
      safeAddressSynced: state.safeAddressSynced,
      markSafeAddressSynced: state.markSafeAddressSynced,
    })),
  );

  useEffect(() => {
    // Only run when we have a new user (different userId)
    if (!user || user.userId === lastUserId.current) return;

    // Set immediately to prevent race condition with async updates
    lastUserId.current = user.userId;

    const initializeUser = async () => {
      try {
        // Mark as initialized immediately to prevent duplicate runs
        hasInitialized.current = true;

        // 1. Update safe address if needed (non-blocking failure)
        if (user.safeAddress && !safeAddressSynced[user.userId]) {
          try {
            await withRefreshToken(() => updateSafeAddress(user.safeAddress));
            markSafeAddressSynced(user.userId);
          } catch (error: any) {
            // 409 means safe address is already registered - this is expected, not an error
            if (error?.status === 409) {
              markSafeAddressSynced(user.userId);
              return;
            }
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

        // PERFORMANCE: Run independent operations in parallel using Promise.allSettled
        // This reduces total initialization time from sequential (~sum of times) to parallel (~max time)
        // Using allSettled so failures in one don't block others
        await Promise.allSettled([
          // 2. Check balance and update deposit status (non-blocking)
          (async () => {
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
          })(),

          // 3. Fetch points (non-blocking)
          (async () => {
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
          })(),
        ]);
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
