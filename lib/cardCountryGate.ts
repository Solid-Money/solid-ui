import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { checkCardAccess, getClientIp, getCountryFromIp } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

/**
 * Outcome of the card country gate.
 *
 * - `supported` — the country is known and the card is available there, so the
 *   caller can continue straight into the card / KYC flow.
 * - `needs_selection` — the country is unknown, undetectable or unsupported, so
 *   the caller must send the user to the country selection screen
 *   (`path.CARD_COUNTRY_SELECTION`) before anything else.
 */
export type CardCountryGateResult = 'supported' | 'needs_selection';

/**
 * Resolves the user's card country the same way `/card/activate` does on mount
 * (see `useCountryCheck`), but imperatively — so an entry point that isn't a
 * screen can run the same gate before it navigates.
 *
 * This is the logic behind the old `/card` page's "Get your card" button: it
 * pushed to `/card/activate`, whose mount-time check funnels anyone whose
 * country can't be confirmed into the country selection screen. The redesigned
 * home CTAs open KYC directly, so they call this first to keep that step.
 *
 * Never throws — any failure means "we can't confirm the country", which hands
 * the decision to the user on the selection screen.
 *
 * @param source analytics label for the entry point that ran the gate
 */
export const resolveCardCountry = async (source?: string): Promise<CardCountryGateResult> => {
  const store = useCountryStore.getState();

  track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_STARTED, { source });

  try {
    // Already resolved — detected earlier, or picked by hand on the selection
    // screen. Mirrors `validCountryInfo` in useCountryCheck.
    if (store.countryInfo?.isAvailable) {
      track(TRACKING_EVENTS.CARD_COUNTRY_AVAILABILITY_CHECKED, {
        countryCode: store.countryInfo.countryCode,
        countryName: store.countryInfo.countryName,
        isAvailable: true,
        source: 'cached_country_info',
      });
      return 'supported';
    }

    let ip = store.getCachedIp();

    if (ip) {
      track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_IP_FETCHED, { ip, source: 'cache' });
    } else {
      ip = await getClientIp();

      if (!ip) {
        track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_IP_FAILED, { reason: 'no_ip_returned' });
        return 'needs_selection';
      }

      store.setCachedIp(ip);
      track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_IP_FETCHED, { ip });
    }

    const cachedInfo = store.getIpDetectedCountry(ip);

    if (cachedInfo) {
      // Keep the active country in sync with what this IP resolved to, so the
      // selection screen opens on it and KYC provider routing sees it.
      store.setCountryInfo(cachedInfo);

      track(TRACKING_EVENTS.CARD_COUNTRY_AVAILABILITY_CHECKED, {
        countryCode: cachedInfo.countryCode,
        countryName: cachedInfo.countryName,
        isAvailable: cachedInfo.isAvailable,
        source: 'cached_ip_country',
        ip,
      });

      return cachedInfo.isAvailable ? 'supported' : 'needs_selection';
    }

    // Detection already failed once — skip the retry and let the user pick.
    if (store.countryDetectionFailed) {
      track(TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, {
        reason: 'previous_detection_failed',
        ip,
      });
      return 'needs_selection';
    }

    const countryData = await getCountryFromIp();

    if (!countryData) {
      store.setCountryDetectionFailed(true);
      track(TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, {
        reason: 'no_country_data_from_ip',
        ip,
      });
      return 'needs_selection';
    }

    const { countryCode, countryName } = countryData;
    track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_DETECTED, { countryCode, countryName, ip });

    const accessCheck = await withRefreshToken(() => checkCardAccess(countryCode));

    if (!accessCheck) {
      store.setCountryDetectionFailed(true);
      track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_FAILED, {
        reason: 'access_check_failed',
        countryCode,
        countryName,
        ip,
      });
      return 'needs_selection';
    }

    store.setIpDetectedCountry(ip, {
      countryCode,
      countryName,
      isAvailable: accessCheck.hasAccess,
    });
    store.setCountryDetectionFailed(false);

    track(TRACKING_EVENTS.CARD_COUNTRY_AVAILABILITY_CHECKED, {
      countryCode,
      countryName,
      isAvailable: accessCheck.hasAccess,
      source: 'ip_detection',
      ip,
    });

    if (accessCheck.hasAccess) {
      track(TRACKING_EVENTS.CARD_KYC_COUNTRY_SUPPORTED, { countryCode, countryName, ip });
      return 'supported';
    }

    track(TRACKING_EVENTS.CARD_KYC_COUNTRY_NOT_SUPPORTED, { countryCode, countryName, ip });
    return 'needs_selection';
  } catch (error) {
    console.error('Error checking card country:', error);
    useCountryStore.getState().setCountryDetectionFailed(true);
    track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_FAILED, {
      reason: 'unexpected_error',
      error: (error as Error)?.message,
    });
    return 'needs_selection';
  }
};
