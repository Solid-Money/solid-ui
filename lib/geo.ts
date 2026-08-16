/**
 * IP geolocation.
 *
 * One request to a lookup service returns the caller's IP and where it is.
 * Providers are tried in order until one answers with a usable ISO country
 * code, so a single service being down, rate-limiting us or blocked on a
 * network doesn't strand the user. IPinfo goes first when a token is
 * configured — see {@link ipinfoLite} — and the rest of the chain is free and
 * key-less, so detection keeps working on a build that has no token.
 *
 * The result is memoised for {@link CACHE_TTL_MS}: concurrent callers share
 * one in-flight request, and later callers are served from memory. Nothing is
 * persisted — a stale country outlives a flight or a VPN toggle, and the
 * lookup is cheap enough to redo per session.
 */

import { EXPO_PUBLIC_IPINFO_TOKEN } from '@/lib/config';

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
  /** Merged over the default `Accept`, for providers that authenticate. */
  headers?: Record<string, string>;
  parse: (data: Record<string, any>) => GeoLocation | null;
}

const REQUEST_TIMEOUT_MS = 3_000;
/**
 * Ceiling on the whole fallback chain. Callers block a spinner — or a whole
 * screen — on this, so trying every provider at its own timeout (which would
 * add up to far longer than anyone will wait) is worse than giving up and
 * letting them pick a country by hand.
 */
const TOTAL_BUDGET_MS = 8_000;
const CACHE_TTL_MS = 30 * 60 * 1000;

const isAlpha2 = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z]{2}$/.test(value);

/**
 * IPinfo, tried ahead of everything else whenever a token is configured.
 *
 * Its key-less endpoint — still in {@link PROVIDERS} below, for builds without
 * a token — allows 1,000 lookups a day *shared by every caller on the same
 * source IP*, so a carrier NAT or an office network can exhaust it without us
 * sending a single request. A signed-up free plan removes the cap entirely.
 *
 * That free plan serves IPinfo Lite, which resolves the country and the ASN but
 * no city or region. The availability gate gets what it needs (the country);
 * the region-interest lead loses the finer detail a key-less provider would
 * have guessed at, and the backend stamps the request IP on that record anyway.
 */
const ipinfoLite = (token: string): GeoProvider => ({
  name: 'ipinfo.io (lite)',
  url: 'https://api.ipinfo.io/lite/me',
  // Bearer over `?token=`, so the token stays out of URLs and proxy logs. The
  // endpoint allows the header cross-origin, so the web build preflights fine.
  headers: { Authorization: `Bearer ${token}` },
  parse: data =>
    isAlpha2(data.country_code)
      ? {
          ip: data.ip,
          countryCode: data.country_code,
          countryName: data.country ?? data.country_code,
        }
      : null,
});

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
    // Key-less, and rate-limited as described on `ipinfoLite`, but it knows the
    // city and region that Lite doesn't. Worth keeping for builds with no token.
    name: 'ipinfo.io (keyless)',
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

const fetchJson = async (
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<Record<string, any> | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
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

/**
 * The chain to try, in order: IPinfo leads when a token is configured, and the
 * key-less providers stand on their own when it isn't.
 */
const providerChain = (): GeoProvider[] => {
  const token = EXPO_PUBLIC_IPINFO_TOKEN.trim();

  // Without a token the endpoint answers 403, so don't spend a hop on it.
  return token ? [ipinfoLite(token), ...PROVIDERS] : PROVIDERS;
};

const lookup = async (): Promise<GeoLocation | null> => {
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (const provider of providerChain()) {
    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      console.warn('[geo] IP lookup budget exhausted');
      return null;
    }

    const data = await fetchJson(
      provider.url,
      Math.min(REQUEST_TIMEOUT_MS, remaining),
      provider.headers,
    );
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
