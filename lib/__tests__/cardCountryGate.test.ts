/// <reference types="jest" />

import { checkCardAccess } from '@/lib/api';
import { resolveCardCountry } from '@/lib/cardCountryGate';
import { detectGeo } from '@/lib/geo';
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
  checkCardAccess: jest.fn(),
  checkVaAccess: jest.fn(),
}));

jest.mock('@/lib/geo', () => ({ detectGeo: jest.fn() }));

const mockDetectGeo = detectGeo as jest.MockedFunction<typeof detectGeo>;
const mockCheckCardAccess = checkCardAccess as jest.MockedFunction<typeof checkCardAccess>;

describe('resolveCardCountry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCountryStore.getState().clearCountryInfo();
  });

  it('proceeds without a geo lookup when the country is already known', async () => {
    useCountryStore.getState().setCountryInfo({
      countryCode: 'US',
      countryName: 'United States',
      isAvailable: true,
      source: 'manual',
    });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: true, countryCode: 'US' });

    await expect(resolveCardCountry()).resolves.toBe('supported');
    expect(mockDetectGeo).not.toHaveBeenCalled();
  });

  it('re-checks a known country so an opened market is picked up', async () => {
    useCountryStore.getState().setCountryInfo({
      countryCode: 'AR',
      countryName: 'Argentina',
      isAvailable: false,
      source: 'manual',
    });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: true, countryCode: 'AR' });

    await expect(resolveCardCountry()).resolves.toBe('supported');
    expect(useCountryStore.getState().countryInfo).toMatchObject({
      countryCode: 'AR',
      isAvailable: true,
    });
  });

  it('asks for a country when the geo lookup fails', async () => {
    mockDetectGeo.mockResolvedValue(null);

    await expect(resolveCardCountry()).resolves.toBe('needs_selection');
    expect(mockCheckCardAccess).not.toHaveBeenCalled();
  });

  it('proceeds when the detected country has card access, and stores it', async () => {
    mockDetectGeo.mockResolvedValue({
      ip: '1.2.3.4',
      countryCode: 'US',
      countryName: 'United States',
      region: 'California',
    });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: true, countryCode: 'US' });

    await expect(resolveCardCountry()).resolves.toBe('supported');
    expect(useCountryStore.getState().countryInfo).toMatchObject({
      countryCode: 'US',
      isAvailable: true,
      state: 'California',
      source: 'ip',
    });
  });

  it('asks for a country when the detected country has no card access', async () => {
    mockDetectGeo.mockResolvedValue({
      countryCode: 'RU',
      countryName: 'Russia',
    });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: false, countryCode: 'RU' });

    await expect(resolveCardCountry()).resolves.toBe('needs_selection');
    // Stored so the pop-up can name the country and log it as a lead.
    expect(useCountryStore.getState().countryInfo).toMatchObject({
      countryCode: 'RU',
      countryName: 'Russia',
      isAvailable: false,
    });
  });

  it('asks for a country when the access check throws', async () => {
    mockDetectGeo.mockResolvedValue({ countryCode: 'US', countryName: 'United States' });
    mockCheckCardAccess.mockRejectedValue(new Error('boom'));

    await expect(resolveCardCountry()).resolves.toBe('needs_selection');
  });
});
