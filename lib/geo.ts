/**
 * IP geolocation.
 *
 * One request to a free, key-less lookup service returns the caller's IP and
 * where it is. Providers are tried in order until one answers with a usable
 * ISO country code, so a single service being down, rate-limiting us or
 * blocked on a network doesn't strand the user.
 *
 * The result is memoised for {@link CACHE_TTL_MS}: concurrent callers share
 * one in-flight request, and later callers are served from memory. Nothing is
 * persisted — a stale country outlives a flight or a VPN toggle, and the
 * lookup is cheap enough to redo per session.
 */

export interface GeoLocation {
  /** Caller's public IP, when the provider returned one. */
  ip?: string;
  /** ISO 3166-1 alpha-2, uppercase. */
  countryCode: string;
  countryName: string;
  /** State / province, when the provider resolved one. */
  region?: string;
  city?: string;
}

interface GeoProvider {
  name: string;
  url: string;
  parse: (data: Record<string, any>) => GeoLocation | null;
}

const REQUEST_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 30 * 60 * 1000;

const isAlpha2 = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z]{2}$/.test(value);

/**
 * Free, no-API-key lookups. Ordered by how much of {@link GeoLocation} they
 * fill in — the last two only know the country, which is all the availability
 * gate strictly needs.
 */
const PROVIDERS: GeoProvider[] = [
  {
    name: 'ipwho.is',
    url: 'https://ipwho.is/',
    // Signals failure with `success: false` and HTTP 200, so check it.
    parse: data =>
      data.success === false || !isAlpha2(data.country_code)
        ? null
        : {
            ip: data.ip,
            countryCode: data.country_code,
            countryName: data.country ?? data.country_code,
            region: data.region,
            city: data.city,
          },
  },
  {
    name: 'ipapi.co',
    url: 'https://ipapi.co/json/',
    parse: data =>
      data.error || !isAlpha2(data.country_code)
        ? null
        : {
            ip: data.ip,
            countryCode: data.country_code,
            countryName: data.country_name ?? data.country_code,
            region: data.region,
            city: data.city,
          },
  },
  {
    name: 'geojs.io',
    url: 'https://get.geojs.io/v1/ip/geo.json',
    parse: data =>
      isAlpha2(data.country_code)
        ? {
            ip: data.ip,
            countryCode: data.country_code,
            countryName: data.country ?? data.country_code,
            region: data.region,
            city: data.city,
          }
        : null,
  },
  {
    name: 'freeipapi.com',
    url: 'https://freeipapi.com/api/json',
    parse: data =>
      isAlpha2(data.countryCode)
        ? {
            ip: data.ipAddress,
            countryCode: data.countryCode,
            countryName: data.countryName ?? data.countryCode,
            region: data.regionName,
            city: data.cityName,
          }
        : null,
  },
  {
    name: 'ipinfo.io',
    url: 'https://ipinfo.io/json',
    parse: data =>
      isAlpha2(data.country)
        ? {
            ip: data.ip,
            countryCode: data.country,
            countryName: data.country,
            region: data.region,
            city: data.city,
          }
        : null,
  },
  {
    name: 'country.is',
    url: 'https://api.country.is/',
    parse: data =>
      isAlpha2(data.country)
        ? { ip: data.ip, countryCode: data.country, countryName: data.country }
        : null,
  },
];

const fetchJson = async (url: string): Promise<Record<string, any> | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

let cached: { value: GeoLocation; at: number } | null = null;
let inFlight: Promise<GeoLocation | null> | null = null;

const lookup = async (): Promise<GeoLocation | null> => {
  for (const provider of PROVIDERS) {
    const data = await fetchJson(provider.url);
    if (!data) continue;

    try {
      const location = provider.parse(data);
      if (location) {
        return { ...location, countryCode: location.countryCode.toUpperCase() };
      }
    } catch {
      // Malformed payload — treat it like a failed provider and move on.
    }
  }

  console.warn('[geo] every IP lookup provider failed');
  return null;
};

/**
 * Resolve where the caller is, or `null` if every provider failed.
 * Never throws — callers treat `null` as "we can't confirm the country".
 */
export const detectGeo = async (): Promise<GeoLocation | null> => {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  if (inFlight) return inFlight;

  inFlight = lookup()
    .then(location => {
      if (location) cached = { value: location, at: Date.now() };
      return location;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/** The caller's public IP, or `null` if it couldn't be resolved. */
export const getClientIp = async (): Promise<string | null> => (await detectGeo())?.ip ?? null;

/** Drop the memoised location — used by tests and on sign-out. */
export const clearGeoCache = () => {
  cached = null;
  inFlight = null;
};
