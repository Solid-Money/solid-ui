import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Application from 'expo-application';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { fetchReferralInvite } from '@/lib/api';
import { parseInstallReferrer } from '@/lib/referral/inviteCode';
import { useReferralStore } from '@/store/useReferralStore';
import { useUserStore } from '@/store/useUserStore';

/**
 * Android's half of the deferred deep link: the invite page sends Android users
 * to Google Play with `referrer=ref=CODE`, and Play hands that back to the app
 * on its first launch. This reads it once and stores the code for signup, the
 * same way the invite page does when the app was already installed.
 *
 * Read once, ever (an MMKV flag), and only where it can matter: a first launch
 * with nobody signed in on the device and no code already captured by a link.
 * If Play's referrer service turns the read down, the flag is cleared again so
 * the next launch asks once more (Play keeps the referrer for 90 days after
 * install); anything after a successful read is final.
 * The code is checked against the public invite lookup before it is kept; if
 * the lookup itself is unavailable the code is kept anyway, because signup
 * validates it again and a missing endpoint should not cost the referrer.
 */
export const useInstallReferrerCapture = () => {
  const referralHydrated = useReferralStore(state => state._hasHydrated);
  const usersHydrated = useUserStore(state => state._hasHydrated);

  useEffect(() => {
    if (Platform.OS !== 'android' || !referralHydrated || !usersHydrated) return;

    const referral = useReferralStore.getState();
    if (referral.installReferrerChecked) return;
    // Mark first: a crash or a slow lookup must not turn "once" into "every launch".
    referral.setInstallReferrerChecked();

    if (useUserStore.getState().users.length > 0 || referral.referralCode) return;

    // No cancellation on unmount: what this writes is the store, not component
    // state.
    const capture = async () => {
      let referrer: string;
      try {
        referrer = await Application.getInstallReferrerAsync();
      } catch (error) {
        // No Play Store on the device, or its referrer service is unavailable
        // right now. Ask again next launch rather than lose the invite: the flag
        // was only set first so a crash in the native call can't repeat forever.
        useReferralStore.getState().setInstallReferrerChecked(false);
        console.warn('Install referrer unavailable:', error);
        return;
      }

      try {
        const code = parseInstallReferrer(referrer);
        if (!code) return;

        let validCode: string | null = code;
        try {
          const lookup = await fetchReferralInvite(code);
          validCode = lookup.valid ? lookup.code : null;
        } catch {
          // The lookup is down or not deployed yet: keep the code, signup decides.
        }
        if (!validCode) {
          track(TRACKING_EVENTS.INVITE_CODE_INVALID, { source: 'install_referrer' });
          return;
        }
        // A link opened in the meantime wins: it is the more recent invite.
        if (useReferralStore.getState().referralCode) return;
        useReferralStore.getState().setReferralCode(validCode, 'install_referrer');
        track(TRACKING_EVENTS.INVITE_CODE_APPLIED, { source: 'install_referrer' });
      } catch (error) {
        console.warn('Install referrer capture failed:', error);
      }
    };

    void capture();
  }, [referralHydrated, usersHydrated]);
};
