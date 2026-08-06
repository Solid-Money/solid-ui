/// <reference types="jest" />

import { checkCardAccess, getClientIp, getCountryFromIp } from '@/lib/api';
import { resolveCardCountry } from '@/lib/cardCountryGate';
import { useCountryStore } from '@/store/useCountryStore';

// The country store persists through MMKV, which has no native module under jest.
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({
    setItem: jest.fn(),
    getItem: () => null,
    removeItem: jest.fn(),
  }),
}));

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

// Only `withRefreshToken` is used from @/lib/utils; stubbing it keeps the whole
// wallet/viem dependency tree out of this test.
jest.mock('@/lib/utils', () => ({
  withRefreshToken: <T>(apiCall: () => Promise<T>) => apiCall(),
}));

jest.mock('@/lib/api', () => ({
  getClientIp: jest.fn(),
  getCountryFromIp: jest.fn(),
  checkCardAccess: jest.fn(),
}));

const mockGetClientIp = getClientIp as jest.MockedFunction<typeof getClientIp>;
const mockGetCountryFromIp = getCountryFromIp as jest.MockedFunction<typeof getCountryFromIp>;
const mockCheckCardAccess = checkCardAccess as jest.MockedFunction<typeof checkCardAccess>;

describe('resolveCardCountry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCountryStore.getState().clearCountryInfo();
  });

  it('proceeds without any lookup when the active country is already supported', async () => {
    useCountryStore.getState().setCountryInfo({
      countryCode: 'US',
      countryName: 'United States',
      isAvailable: true,
    });

    await expect(resolveCardCountry()).resolves.toBe('supported');
    expect(mockGetClientIp).not.toHaveBeenCalled();
    expect(mockCheckCardAccess).not.toHaveBeenCalled();
  });

  it('asks for a country when the IP cannot be resolved', async () => {
    mockGetClientIp.mockResolvedValue(null);

    await expect(resolveCardCountry()).resolves.toBe('needs_selection');
    expect(mockGetCountryFromIp).not.toHaveBeenCalled();
  });

  it('proceeds when the detected country has card access, and caches it', async () => {
    mockGetClientIp.mockResolvedValue('1.2.3.4');
    mockGetCountryFromIp.mockResolvedValue({ countryCode: 'US', countryName: 'United States' });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: true, countryCode: 'US' });

    await expect(resolveCardCountry()).resolves.toBe('supported');
    expect(useCountryStore.getState().countryInfo).toMatchObject({
      countryCode: 'US',
      isAvailable: true,
      source: 'ip',
    });

    // Second run is served from the store — no repeat lookups.
    await expect(resolveCardCountry()).resolves.toBe('supported');
    expect(mockCheckCardAccess).toHaveBeenCalledTimes(1);
  });

  it('asks for a country when the detected country has no card access', async () => {
    mockGetClientIp.mockResolvedValue('1.2.3.4');
    mockGetCountryFromIp.mockResolvedValue({ countryCode: 'RU', countryName: 'Russia' });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: false, countryCode: 'RU' });

    await expect(resolveCardCountry()).resolves.toBe('needs_selection');
    expect(useCountryStore.getState().countryInfo).toMatchObject({
      countryCode: 'RU',
      isAvailable: false,
    });

    // The cached "not available" answer is reused rather than re-checked.
    await expect(resolveCardCountry()).resolves.toBe('needs_selection');
    expect(mockCheckCardAccess).toHaveBeenCalledTimes(1);
  });

  it('asks for a country when country detection fails, and does not retry it', async () => {
    mockGetClientIp.mockResolvedValue('1.2.3.4');
    mockGetCountryFromIp.mockResolvedValue(null);

    await expect(resolveCardCountry()).resolves.toBe('needs_selection');
    expect(useCountryStore.getState().countryDetectionFailed).toBe(true);

    await expect(resolveCardCountry()).resolves.toBe('needs_selection');
    expect(mockGetCountryFromIp).toHaveBeenCalledTimes(1);
  });

  it('asks for a country when the access check throws', async () => {
    mockGetClientIp.mockResolvedValue('1.2.3.4');
    mockGetCountryFromIp.mockResolvedValue({ countryCode: 'US', countryName: 'United States' });
    mockCheckCardAccess.mockRejectedValue(new Error('boom'));

    await expect(resolveCardCountry()).resolves.toBe('needs_selection');
    expect(useCountryStore.getState().countryDetectionFailed).toBe(true);
  });
});
