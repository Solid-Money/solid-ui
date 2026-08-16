/// <reference types="jest" />

import { clearGeoCache, detectGeo, getClientIp } from '@/lib/geo';

const okJson = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) });

const mockFetch = jest.fn();

// Mutable so a test can hand the chain a token; the default (no token) is what
// the key-less expectations below assume. Read through a getter because
// `jest.mock` is hoisted above this declaration.
const mockConfig = { EXPO_PUBLIC_IPINFO_TOKEN: '' };
jest.mock('@/lib/config', () => ({
  __esModule: true,
  get EXPO_PUBLIC_IPINFO_TOKEN() {
    return mockConfig.EXPO_PUBLIC_IPINFO_TOKEN;
  },
}));

beforeEach(() => {
  mockConfig.EXPO_PUBLIC_IPINFO_TOKEN = '';
});

describe('detectGeo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearGeoCache();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('returns the first provider that answers, without calling the rest', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        ip: '1.2.3.4',
        success: true,
        country_code: 'ng',
        country: 'Nigeria',
        region: 'Lagos',
        city: 'Ikeja',
      }),
    );

    await expect(detectGeo()).resolves.toEqual({
      ip: '1.2.3.4',
      countryCode: 'NG',
      countryName: 'Nigeria',
      region: 'Lagos',
      city: 'Ikeja',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls through to the next provider when one fails', async () => {
    mockFetch
      // Network error.
      .mockRejectedValueOnce(new Error('offline'))
      // HTTP error (rate limited).
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce(okJson({ ip: '5.6.7.8', country_code: 'DE', country: 'Germany' }));

    await expect(detectGeo()).resolves.toMatchObject({ countryCode: 'DE' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('treats an HTTP 200 error payload as a failed provider', async () => {
    mockFetch
      // ipwho.is reports failure in the body, not the status code.
      .mockResolvedValueOnce(okJson({ success: false, message: 'Reserved range' }))
      // ipapi.co reports it as `error: true`.
      .mockResolvedValueOnce(okJson({ error: true, reason: 'RateLimited' }))
      .mockResolvedValueOnce(okJson({ country_code: 'FR', country: 'France' }));

    await expect(detectGeo()).resolves.toMatchObject({ countryCode: 'FR' });
  });

  it('resolves null when every provider fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    await expect(detectGeo()).resolves.toBeNull();
    // Every provider was tried before giving up.
    expect(mockFetch.mock.calls.length).toBeGreaterThan(3);
  });

  it('gives up once the overall budget is spent instead of trying every provider', async () => {
    // Each attempt "costs" 4s of wall clock, so the 8s budget runs out well
    // before the provider list does — a caller is never blocked for the sum of
    // every provider's timeout.
    let now = 1_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockFetch.mockImplementation(() => {
      now += 4_000;
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    await expect(detectGeo()).resolves.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });

  it('memoises the result and shares one in-flight request', async () => {
    mockFetch.mockResolvedValue(okJson({ ip: '1.1.1.1', country_code: 'US', country: 'USA' }));

    const [a, b] = await Promise.all([detectGeo(), detectGeo()]);

    expect(a).toEqual(b);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await detectGeo();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed lookup', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    await expect(detectGeo()).resolves.toBeNull();

    const callsAfterFailure = mockFetch.mock.calls.length;
    mockFetch.mockResolvedValue(okJson({ country_code: 'GB', country: 'United Kingdom' }));

    await expect(detectGeo()).resolves.toMatchObject({ countryCode: 'GB' });
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterFailure);
  });
});

describe('IPinfo', () => {
  const LITE_URL = 'https://api.ipinfo.io/lite/me';
  const liteResponse = {
    ip: '8.8.8.8',
    asn: 'AS15169',
    as_name: 'Google LLC',
    country_code: 'US',
    country: 'United States',
    continent_code: 'NA',
    continent: 'North America',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearGeoCache();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('is asked first, with the token, and settles the lookup on its own', async () => {
    mockConfig.EXPO_PUBLIC_IPINFO_TOKEN = 'tok_123';
    mockFetch.mockResolvedValueOnce(okJson(liteResponse));

    // Lite is country-level only — no region or city, which the gate doesn't need.
    await expect(detectGeo()).resolves.toEqual({
      ip: '8.8.8.8',
      countryCode: 'US',
      countryName: 'United States',
      region: undefined,
      city: undefined,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(LITE_URL);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok_123' });
  });

  it('is skipped without a token rather than spending a hop on a 403', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ country_code: 'NG', country: 'Nigeria' }));

    await expect(detectGeo()).resolves.toMatchObject({ countryCode: 'NG' });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).not.toContain('api.ipinfo.io');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('falls through to the key-less providers when the token is rejected', async () => {
    mockConfig.EXPO_PUBLIC_IPINFO_TOKEN = 'revoked';
    mockFetch
      // 403 "Unknown token".
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce(okJson({ country_code: 'GB', country: 'United Kingdom' }));

    await expect(detectGeo()).resolves.toMatchObject({ countryCode: 'GB' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe(LITE_URL);
  });
});

describe('getClientIp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearGeoCache();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('returns the IP from the geo lookup', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ ip: '9.9.9.9', country_code: 'US', country: 'USA' }));

    await expect(getClientIp()).resolves.toBe('9.9.9.9');
  });

  it('returns null when the lookup fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    await expect(getClientIp()).resolves.toBeNull();
  });
});
