import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { referralCodeFromParams } from '@/lib/referral/inviteCode';

/**
 * How a referral code reached this device: a `?ref=` link (`url`), the invite
 * page (`link`), the Play install referrer, the iOS clipboard hand-off, or typed
 * on the signup screen.
 */
export type ReferralCodeSource = 'url' | 'link' | 'install_referrer' | 'clipboard' | 'manual';

interface ReferralState {
  referralCode: string | null;
  referralSource: ReferralCodeSource | null;
  /**
   * Android: the Play install referrer has been read. It is the same answer on
   * every launch, so it is asked for once, on the first launch.
   */
  installReferrerChecked: boolean;
  _hasHydrated: boolean;
  setReferralCode: (code: string | null, source?: ReferralCodeSource) => void;
  setInstallReferrerChecked: () => void;
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
      referralSource: null,
      installReferrerChecked: false,
      _hasHydrated: false,

      setReferralCode: (code: string | null, source?: ReferralCodeSource) => {
        const trimmedCode = code && code.trim() ? code.trim() : null;
        set({ referralCode: trimmedCode, referralSource: trimmedCode ? (source ?? null) : null });
        if (trimmedCode) {
          console.warn('Referral code saved:', trimmedCode);
        }
      },

      setInstallReferrerChecked: () => {
        set({ installReferrerChecked: true });
      },

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },

      clearReferralCode: () => {
        set({ referralCode: null, referralSource: null });
        console.warn('Referral code cleared');
      },

      detectAndSaveReferralCode: () => {
        if (Platform.OS !== 'web') return null;

        try {
          // 'ref', plus the legacy 'refCode' / 'referralCode' / 'referral' —
          // only values that are actually codes (`/rewards?referral=open` is not).
          const code = referralCodeFromParams(new URLSearchParams(window.location.search));

          if (code) {
            get().setReferralCode(code, 'url');
            return code;
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
            const urlReferralCode = referralCodeFromParams(
              new URLSearchParams(window.location.search),
            );

            if (urlReferralCode) {
              // Save it to storage for future use
              get().setReferralCode(urlReferralCode, 'url');
              return urlReferralCode;
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
