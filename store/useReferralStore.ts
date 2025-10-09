import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';

interface ReferralState {
  referralCode: string | null;
  setReferralCode: (code: string | null) => void;
  clearReferralCode: () => void;
  getReferralCodeForSignup: () => string | null;
}

/**
 * Zustand store for managing referral codes with cross-platform persistence via MMKV
 */
export const useReferralStore = create<ReferralState>()(
  persist(
    (set, get) => ({
      referralCode: null,

      setReferralCode: (code: string | null) => {
        const trimmedCode = code && code.trim() ? code.trim() : null;
        set({ referralCode: trimmedCode });
        if (trimmedCode) {
          console.warn('Referral code saved:', trimmedCode);
        }
      },

      clearReferralCode: () => {
        set({ referralCode: null });
        console.warn('Referral code cleared');
      },

      getReferralCodeForSignup: () => {
        // Check for query parameter (backward compatibility with old ?referralCode= format)
        if (Platform.OS === 'web') {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlReferralCode = urlParams.get('referralCode');

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

        // Return from storage (primary method - saved by /join/ route)
        return get().referralCode;
      },
    }),
    {
      name: USER.referralStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.referralStorageKey)),
    },
  ),
);
