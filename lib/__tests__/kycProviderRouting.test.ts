/// <reference types="jest" />

import { getProviderRouting } from '@/lib/api';
import { detectGeo } from '@/lib/geo';
import { resolveKycProvider } from '@/lib/kycProviderRouting';
import { CardProvider, KycProvider } from '@/lib/types';
import { useCountryStore } from '@/store/useCountryStore';

jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({ setItem: jest.fn(), getItem: () => null, removeItem: jest.fn() }),
}));
jest.mock('@/lib/utils', () => ({
  withRefreshToken: <T>(apiCall: () => Promise<T>) => apiCall(),
}));
jest.mock('@/lib/api', () => ({ getProviderRouting: jest.fn() }));
jest.mock('@/lib/geo', () => ({ detectGeo: jest.fn() }));

const mockDetectGeo = detectGeo as jest.MockedFunction<typeof detectGeo>;
const mockGetProviderRouting = getProviderRouting as jest.MockedFunction<typeof getProviderRouting>;

/** What the backend answers for a Wirex jurisdiction. */
const wirexRouting = (countryCode: string) => ({
  countryCode,
  cardProvider: CardProvider.WIREX,
  kycProvider: KycProvider.SUMSUB,
});

const storeCountry = (countryCode: string) =>
  useCountryStore.getState().setCountryInfo({
    countryCode,
    countryName: countryCode,
    isAvailable: true,
    source: 'ip',
  });

beforeEach(() => {
  jest.clearAllMocks();
  useCountryStore.getState().clearCountryInfo();
});

describe('resolveKycProvider', () => {
  it('routes a Wirex country to Sumsub', async () => {
    storeCountry('DE');
    mockGetProviderRouting.mockResolvedValue(wirexRouting('DE'));

    await expect(resolveKycProvider()).resolves.toEqual({
      kycProvider: KycProvider.SUMSUB,
      countryCode: 'DE',
    });
    // 'card' is passed explicitly: the backend gates the card answer on whether
    // Wirex is enabled in that environment.
    expect(mockGetProviderRouting).toHaveBeenCalledWith('DE', 'card');
  });

  it('routes everywhere else to Didit', async () => {
    storeCountry('US');
    mockGetProviderRouting.mockResolvedValue({
      countryCode: 'US',
      cardProvider: CardProvider.RAIN,
      kycProvider: KycProvider.DIDIT,
    });

    await expect(resolveKycProvider()).resolves.toEqual({
      kycProvider: KycProvider.DIDIT,
      countryCode: 'US',
    });
  });

  // The regression this helper exists for: the card country gate persists the
  // country and the entry point invokes the KYC action in the same tick, before
  // React has re-rendered. Reading the country at call time is what stops a
  // Wirex user landing on Didit on their first "Verify now" press.
  it('picks up a country the gate persisted after the caller was rendered', async () => {
    // Rendered with no country — this is what a render closure would capture.
    const countryAtRenderTime = useCountryStore.getState().countryInfo?.countryCode;
    expect(countryAtRenderTime).toBeUndefined();

    // The gate resolves and persists the country...
    storeCountry('GB');
    mockGetProviderRouting.mockResolvedValue(wirexRouting('GB'));

    // ...and the action runs before any re-render.
    await expect(resolveKycProvider()).resolves.toEqual({
      kycProvider: KycProvider.SUMSUB,
      countryCode: 'GB',
    });
  });

  it('falls back to an IP lookup when no country is stored', async () => {
    mockDetectGeo.mockResolvedValue({ countryCode: 'FR', countryName: 'France' });
    mockGetProviderRouting.mockResolvedValue(wirexRouting('FR'));

    await expect(resolveKycProvider()).resolves.toEqual({
      kycProvider: KycProvider.SUMSUB,
      countryCode: 'FR',
    });
    expect(mockGetProviderRouting).toHaveBeenCalledWith('FR', 'card');
  });

  it('prefers the stored country over an IP lookup, so a manual pick wins', async () => {
    storeCountry('ES');
    mockGetProviderRouting.mockResolvedValue(wirexRouting('ES'));

    await resolveKycProvider();

    expect(mockDetectGeo).not.toHaveBeenCalled();
  });

  // countryInfo.isAvailable means *card* availability, which only
  // resolveCountryAccess can answer — routing must not write a country with an
  // unknown availability into the store.
  it('does not persist the country it detected', async () => {
    mockDetectGeo.mockResolvedValue({ countryCode: 'IT', countryName: 'Italy' });
    mockGetProviderRouting.mockResolvedValue(wirexRouting('IT'));

    await resolveKycProvider();

    expect(useCountryStore.getState().countryInfo).toBeNull();
  });

  it('keeps the fallback when the country cannot be resolved at all', async () => {
    mockDetectGeo.mockResolvedValue(null);

    await expect(resolveKycProvider()).resolves.toEqual({ kycProvider: KycProvider.DIDIT });
    expect(mockGetProviderRouting).not.toHaveBeenCalled();
  });

  it('honours a caller-supplied fallback when the country is unknown', async () => {
    mockDetectGeo.mockResolvedValue(null);

    await expect(resolveKycProvider(KycProvider.SUMSUB)).resolves.toEqual({
      kycProvider: KycProvider.SUMSUB,
    });
  });

  it('keeps the fallback but reports the country when the routing call fails', async () => {
    storeCountry('DE');
    mockGetProviderRouting.mockRejectedValue(new Error('backend down'));

    await expect(resolveKycProvider()).resolves.toEqual({
      kycProvider: KycProvider.DIDIT,
      countryCode: 'DE',
    });
  });

  it('keeps the fallback when the backend answers without a provider', async () => {
    storeCountry('DE');
    mockGetProviderRouting.mockResolvedValue({} as any);

    await expect(resolveKycProvider()).resolves.toEqual({
      kycProvider: KycProvider.DIDIT,
      countryCode: 'DE',
    });
  });
});

/**
 * The card answer is gated server-side on whether Wirex is enabled in the
 * environment. The onramp must not be caught by that gate: TransFi's use of
 * Sumsub for identity is live in its own right.
 *
 * The client's job either way is to ASK and obey. It holds no copy of the
 * geography, no cohort list and no precedence rule — Wirex now wins the markets
 * both issuers serve, and that decision is entirely the backend's — so these
 * cases pin the request it makes and that it follows whatever comes back.
 */
describe('resolveKycProvider flow gating', () => {
  it('asks for the card answer by default', async () => {
    storeCountry('DE');
    mockGetProviderRouting.mockResolvedValue(wirexRouting('DE'));

    await resolveKycProvider();

    expect(mockGetProviderRouting).toHaveBeenCalledWith('DE', 'card');
  });

  it('asks for the ungated onramp answer when the buy-crypto flow routes', async () => {
    storeCountry('DE');
    mockGetProviderRouting.mockResolvedValue(wirexRouting('DE'));

    await resolveKycProvider(KycProvider.DIDIT, 'onramp');

    expect(mockGetProviderRouting).toHaveBeenCalledWith('DE', 'onramp');
  });

  it('follows the backend when it routes a Wirex country down to Didit', async () => {
    // The client must not second-guess this. A country on the Wirex geography
    // can still come back Rain/Didit — the environment kill switch is off, or
    // the wirex country document has been edited to close that market — and the
    // answer is authoritative either way.
    storeCountry('DE');
    mockGetProviderRouting.mockResolvedValue({
      countryCode: 'DE',
      cardProvider: CardProvider.RAIN,
      kycProvider: KycProvider.DIDIT,
    });

    await expect(resolveKycProvider()).resolves.toEqual({
      kycProvider: KycProvider.DIDIT,
      countryCode: 'DE',
    });
  });
});
