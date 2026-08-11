/// <reference types="jest" />

import { checkCardAccess, checkVaAccess } from '@/lib/api';
import { resolveCountryAccess } from '@/lib/countryAccess';
import { detectGeo } from '@/lib/geo';
import { useCountryStore } from '@/store/useCountryStore';

jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({ setItem: jest.fn(), getItem: () => null, removeItem: jest.fn() }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/utils', () => ({
  withRefreshToken: <T>(apiCall: () => Promise<T>) => apiCall(),
}));
jest.mock('@/lib/api', () => ({ checkCardAccess: jest.fn(), checkVaAccess: jest.fn() }));
jest.mock('@/lib/geo', () => ({ detectGeo: jest.fn() }));

const mockDetectGeo = detectGeo as jest.MockedFunction<typeof detectGeo>;
const mockCheckCardAccess = checkCardAccess as jest.MockedFunction<typeof checkCardAccess>;
const mockCheckVaAccess = checkVaAccess as jest.MockedFunction<typeof checkVaAccess>;

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  jest.clearAllMocks();
  useCountryStore.getState().clearCountryInfo();
});

describe('stored country vs IP detection', () => {
  it('new user: falls back to the IP, and the unserved answer reaches the caller', async () => {
    mockDetectGeo.mockResolvedValue({ countryCode: 'PK', countryName: 'Pakistan' });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: false, countryCode: 'PK' });

    await expect(resolveCountryAccess('card')).resolves.toMatchObject({
      countryCode: 'PK',
      isAvailable: false,
      source: 'ip',
    });
  });

  it('a hand-picked country wins over the IP, so a traveller keeps their choice', async () => {
    useCountryStore.getState().setCountryInfo({
      countryCode: 'GB',
      countryName: 'United Kingdom',
      isAvailable: true,
      source: 'manual',
    });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: true, countryCode: 'GB' });

    await expect(resolveCountryAccess('card')).resolves.toMatchObject({
      countryCode: 'GB',
      isAvailable: true,
      source: 'manual',
    });
    expect(mockDetectGeo).not.toHaveBeenCalled();
  });

  it('a hand-picked unserved country still resolves as unserved', async () => {
    useCountryStore.getState().setCountryInfo({
      countryCode: 'PK',
      countryName: 'Pakistan',
      isAvailable: false,
      source: 'manual',
    });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: false, countryCode: 'PK' });

    await expect(resolveCountryAccess('card')).resolves.toMatchObject({ isAvailable: false });
    expect(mockDetectGeo).not.toHaveBeenCalled();
  });

  it('an IP-detected country older than a day is re-detected', async () => {
    useCountryStore.setState({
      countryInfo: {
        countryCode: 'GB',
        countryName: 'United Kingdom',
        isAvailable: true,
        source: 'ip',
      },
      detectedAt: Date.now() - DAY - 1,
    });
    mockDetectGeo.mockResolvedValue({ countryCode: 'PK', countryName: 'Pakistan' });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: false, countryCode: 'PK' });

    await expect(resolveCountryAccess('card')).resolves.toMatchObject({ countryCode: 'PK' });
    expect(mockDetectGeo).toHaveBeenCalled();
  });

  it('availability is re-checked every time, so an opened market unsticks a stored "no"', async () => {
    useCountryStore.getState().setCountryInfo({
      countryCode: 'AR',
      countryName: 'Argentina',
      isAvailable: false,
      source: 'manual',
    });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: true, countryCode: 'AR' });

    await expect(resolveCountryAccess('card')).resolves.toMatchObject({ isAvailable: true });
  });
});

describe('per-product allow-lists', () => {
  it('a country served for the card but not for virtual accounts answers differently', async () => {
    mockDetectGeo.mockResolvedValue({ countryCode: 'BR', countryName: 'Brazil' });
    mockCheckCardAccess.mockResolvedValue({ hasAccess: true, countryCode: 'BR' });
    mockCheckVaAccess.mockResolvedValue({ hasAccess: false, countryCode: 'BR' });

    await expect(resolveCountryAccess('card')).resolves.toMatchObject({ isAvailable: true });
    await expect(resolveCountryAccess('virtual_account')).resolves.toMatchObject({
      isAvailable: false,
    });
  });

  it('a virtual account check never overwrites the stored card availability', async () => {
    useCountryStore.getState().setCountryInfo({
      countryCode: 'BR',
      countryName: 'Brazil',
      isAvailable: true,
      source: 'manual',
    });
    mockCheckVaAccess.mockResolvedValue({ hasAccess: false, countryCode: 'BR' });

    await resolveCountryAccess('virtual_account');

    expect(useCountryStore.getState().countryInfo).toMatchObject({ isAvailable: true });
  });
});
