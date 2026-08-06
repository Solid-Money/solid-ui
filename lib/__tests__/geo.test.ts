/// <reference types="jest" />

import { clearGeoCache, detectGeo, getClientIp } from '@/lib/geo';

const okJson = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) });

const mockFetch = jest.fn();

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
