import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';

interface ReferralState {
  referralCode: string | null;
  _hasHydrated: boolean;
  setReferralCode: (code: string | null) => void;
  setHasHydrated: (state: boolean) => void;
  clearReferralCode: () => void;
  detectAndSaveReferralCode: () => string | null;
  getReferralCodeForSignup: () => string | null;
}

/**
 * Zustand store for managing referral codes with cross-platform persistence via MMKV
 */
export const useReferralStore = create<ReferralState>()(
  persist(
    (set, get) => ({
      referralCode: null,
      _hasHydrated: false,

      setReferralCode: (code: string | null) => {
        const trimmedCode = code && code.trim() ? code.trim() : null;
        set({ referralCode: trimmedCode });
        if (trimmedCode) {
          console.warn('Referral code saved:', trimmedCode);
        }
      },

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },

      clearReferralCode: () => {
        set({ referralCode: null });
        console.warn('Referral code cleared');
      },

      detectAndSaveReferralCode: () => {
        if (Platform.OS !== 'web') return null;

        try {
          const urlParams = new URLSearchParams(window.location.search);
          // Check for both 'ref', 'refCode' (legacy) and 'referralCode' (legacy)
          const code =
            urlParams.get('ref') || urlParams.get('refCode') || urlParams.get('referralCode');

          if (code && code.trim()) {
            const trimmedCode = code.trim();
            get().setReferralCode(trimmedCode);
            return trimmedCode;
          }
        } catch (error) {
          console.warn('Failed to detect and save referral code:', error);
          Sentry.captureException(error, {
            tags: {
              type: 'referral_code_detection_error',
            },
            level: 'warning',
          });
        }

        return null;
      },

      getReferralCodeForSignup: () => {
        // First try to get from URL (in case user just clicked a referral link)
        if (Platform.OS === 'web') {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            // Check for both 'ref', 'refCode' (legacy) and 'referralCode' (legacy)
            const urlReferralCode =
              urlParams.get('ref') || urlParams.get('refCode') || urlParams.get('referralCode');

            if (urlReferralCode && urlReferralCode.trim()) {
              const trimmedCode = urlReferralCode.trim();
              // Save it to storage for future use
              get().setReferralCode(trimmedCode);
              return trimmedCode;
            }
          } catch (error) {
            console.warn('Failed to extract referral code from URL:', error);
            Sentry.captureException(error, {
              tags: {
                type: 'referral_code_url_extraction_error',
              },
              level: 'warning',
            });
          }
        }

        // If not in URL, return from storage
        return get().referralCode;
      },
    }),
    {
      name: USER.referralStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.referralStorageKey)),
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
