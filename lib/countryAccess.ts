import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { checkCardAccess, checkVaAccess } from '@/lib/api';
import { detectGeo } from '@/lib/geo';
import { GatedProduct } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

/**
 * Where the user is, and whether the product they asked for is served there.
 *
 * `isAvailable` is per product: the card and the USD virtual account run off
 * different allow-lists, so the same country can be open for one and not the
 * other.
 */
export interface CountryAccess {
  countryCode: string;
  countryName: string;
  state?: string;
  city?: string;
  isAvailable: boolean;
  source: 'ip' | 'manual';
}

const ACCESS_CHECK: Record<GatedProduct, (countryCode: string) => Promise<{ hasAccess: boolean }>> =
  {
    card: checkCardAccess,
    virtual_account: checkVaAccess,
  };

/**
 * Ask the backend whether `product` is available in `countryCode`.
 * Returns `null` when the check itself failed, which is not the same as "no".
 */
export const checkProductAccess = async (
  product: GatedProduct,
  countryCode: string,
): Promise<boolean | null> => {
  try {
    const result = await withRefreshToken(() => ACCESS_CHECK[product](countryCode));
    return result?.hasAccess ?? null;
  } catch (error) {
    console.error(`Error checking ${product} access for ${countryCode}:`, error);
    return null;
  }
};

/**
 * Resolve the user's country and whether `product` is available there.
 *
 * The country comes from the store when it's already known and fresh (a manual
 * pick, or a recent IP detection), otherwise from an IP lookup. Detecting the
 * country writes it back to the store so the next caller — and the country
 * selection screen — opens on the same place.
 *
 * Returns `null` only when the country could not be determined at all; callers
 * treat that as "ask the user".
 */
export const resolveCountryAccess = async (
  product: GatedProduct,
  source?: string,
): Promise<CountryAccess | null> => {
  const store = useCountryStore.getState();

  track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_STARTED, { product, source });

  const known = store.isStale() ? null : store.countryInfo;
  const geo = known ? null : await detectGeo();

  if (!known && !geo) {
    track(TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, { product, source });
    return null;
  }

  const countryCode = (known?.countryCode ?? geo!.countryCode).toUpperCase();
  const countryName = known?.countryName ?? geo!.countryName;
  const detectionSource: CountryAccess['source'] = known ? (known.source ?? 'manual') : 'ip';

  const hasAccess = await checkProductAccess(product, countryCode);

  if (hasAccess === null) {
    track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_FAILED, {
      product,
      countryCode,
      countryName,
      source,
    });
    return null;
  }

  const access: CountryAccess = {
    countryCode,
    countryName,
    state: geo?.region ?? known?.state,
    city: geo?.city ?? known?.city,
    isAvailable: hasAccess,
    source: detectionSource,
  };

  persistCountry(access, product);

  track(TRACKING_EVENTS.CARD_COUNTRY_AVAILABILITY_CHECKED, {
    product,
    countryCode,
    countryName,
    isAvailable: hasAccess,
    source: detectionSource,
  });

  return access;
};

/**
 * Keep the store in step with what we just resolved.
 *
 * Only the card writes: `countryInfo.isAvailable` means *card* availability and
 * every consumer reads it that way, so a virtual account check — which runs off
 * a different allow-list — must not overwrite it. The VA flow re-resolves its
 * country per call instead, which costs nothing: `detectGeo` memoises the
 * lookup for the session.
 */
const persistCountry = (access: CountryAccess, product: GatedProduct) => {
  if (product !== 'card') return;

  useCountryStore.getState().setCountryInfo({
    countryCode: access.countryCode,
    countryName: access.countryName,
    state: access.state,
    city: access.city,
    isAvailable: access.isAvailable,
    source: access.source,
  });
};
