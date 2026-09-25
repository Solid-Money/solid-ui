import React from 'react';

import { useCashAppDepositAvailability } from '@/hooks/useCashAppDepositAvailability';
import { detectGeo } from '@/lib/geo';
import { useCountryStore } from '@/store/useCountryStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

// The country store persists through MMKV, which has no native module under jest.
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({
    setItem: jest.fn(),
    getItem: () => null,
    removeItem: jest.fn(),
  }),
}));

jest.mock('@/lib/geo', () => ({ detectGeo: jest.fn() }));
const mockDetectGeo = detectGeo as jest.MockedFunction<typeof detectGeo>;

type Result = ReturnType<typeof useCashAppDepositAvailability>;

/** Render the hook and return its latest value. */
const renderHook = async (): Promise<Result> => {
  let latest: Result | undefined;
  const Probe = () => {
    latest = useCashAppDepositAvailability();
    return null;
  };
  await act(async () => {
    create(<Probe />);
  });
  return latest as Result;
};

const storeCountry = (countryCode: string, state?: string) =>
  useCountryStore.getState().setCountryInfo({
    countryCode,
    countryName: countryCode,
    state,
    isAvailable: true,
    source: 'manual',
  });

describe('useCashAppDepositAvailability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCountryStore.getState().clearCountryInfo();
  });

  it('allows the US', async () => {
    storeCountry('US');
    const result = await renderHook();

    expect(result.isAvailable).toBe(true);
    expect(result.isResolved).toBe(true);
    // The country was already known, so no lookup was needed.
    expect(mockDetectGeo).not.toHaveBeenCalled();
  });

  it('refuses everywhere else — Cash App Lightning is US-only', async () => {
    storeCountry('GB');
    await expect(renderHook()).resolves.toMatchObject({
      isAvailable: false,
      isResolved: true,
    });
  });

  it('accepts a lowercase stored code', async () => {
    storeCountry('us');
    await expect(renderHook()).resolves.toMatchObject({ isAvailable: true });
  });

  it('falls back to an IP lookup when the country is unknown', async () => {
    mockDetectGeo.mockResolvedValue({
      countryCode: 'US',
      countryName: 'United States',
      region: 'California',
    });

    const result = await renderHook();

    expect(mockDetectGeo).toHaveBeenCalled();
    expect(result.isAvailable).toBe(true);
    expect(result.region).toBe('California');
  });

  it('treats an unresolvable country as unavailable, not as permission', async () => {
    // Every geo provider failed. A US-only rail is not something to offer on the
    // strength of not knowing where the user is.
    mockDetectGeo.mockResolvedValue(null);

    await expect(renderHook()).resolves.toMatchObject({
      isAvailable: false,
      isResolved: false,
    });
  });

  describe('isResolving', () => {
    it('reports resolving until the lookup settles, so nothing is decided early', async () => {
      // The race this guards: a caller that treats the first render as an
      // answer sends no country to /config, gets a correct "not available" for
      // that question, and reads it as a verdict on the user.
      let resolveGeo: (value: null) => void = () => {};
      mockDetectGeo.mockReturnValue(
        new Promise(resolve => {
          resolveGeo = resolve as (value: null) => void;
        }),
      );

      let latest: Result | undefined;
      const Probe = () => {
        latest = useCashAppDepositAvailability();
        return null;
      };
      await act(async () => {
        create(<Probe />);
      });

      expect(latest?.isResolving).toBe(true);
      expect(latest?.countryCode).toBeUndefined();

      await act(async () => {
        resolveGeo(null);
      });

      // Settled with no answer is still settled — callers may now act on it.
      expect(latest?.isResolving).toBe(false);
      expect(latest?.isAvailable).toBe(false);
    });

    it('is settled immediately when the country is already known', async () => {
      storeCountry('US');

      const result = await renderHook();

      expect(result.isResolving).toBe(false);
      expect(mockDetectGeo).not.toHaveBeenCalled();
    });
  });
});
