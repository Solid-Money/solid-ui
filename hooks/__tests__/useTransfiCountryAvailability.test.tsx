import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useTransfiCountryAvailability } from '@/hooks/useTransfiCountryAvailability';
import { getTransfiProhibitedCountries } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/config', () => ({ EXPO_PUBLIC_TRANSFI_PROHIBITED_COUNTRIES: 'UA,RU' }));
jest.mock('@/lib/api', () => ({ getTransfiProhibitedCountries: jest.fn() }));
jest.mock('@/hooks/useCashAppDepositAvailability', () => ({
  useCashAppDepositAvailability: () => mockCountry,
}));

const mockCountry: { countryCode: string | undefined; isResolving: boolean } = {
  countryCode: 'DE',
  isResolving: false,
};
const mockFetch = getTransfiProhibitedCountries as jest.MockedFunction<
  typeof getTransfiProhibitedCountries
>;

type Availability = ReturnType<typeof useTransfiCountryAvailability>;

/**
 * Mount the hook and report its latest answer — once it has settled, or, with
 * `settle: false`, right after mounting. Settling can take the hook's one
 * retry (about a second) when the request fails.
 */
const run = async ({ settle = true } = {}): Promise<Availability> => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const answers: Availability[] = [];
  const latest = () => answers[answers.length - 1];
  const Probe = () => {
    answers.push(useTransfiCountryAvailability());
    return null;
  };
  let root: any;
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  const deadline = Date.now() + 5000;
  do {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, settle ? 50 : 0));
    });
  } while (settle && latest().isResolving && Date.now() < deadline);
  root.unmount();
  return latest();
};

/**
 * TransFi is hidden where the build's list OR the admin dashboard's list says
 * so. The dashboard can close a country without a release; it can never
 * reopen one the build closed, and failing to read it must not open anything.
 */
describe('useTransfiCountryAvailability', () => {
  beforeEach(() => {
    mockCountry.countryCode = 'DE';
    mockCountry.isResolving = false;
    mockFetch.mockReset();
  });

  it('hides TransFi in a country closed on the dashboard', async () => {
    mockCountry.countryCode = 'TR';
    mockFetch.mockResolvedValue({ prohibitedCountries: ['tr', 'ID'] });

    const result = await run();

    expect(result.isResolving).toBe(false);
    expect(result.isAvailable).toBe(false);
    expect(result.isCountryProhibited('id')).toBe(true);
  });

  it("keeps the build's list when the dashboard's does not name it", async () => {
    mockCountry.countryCode = 'UA';
    mockFetch.mockResolvedValue({ prohibitedCountries: [] });

    const result = await run();

    expect(result.isResolving).toBe(false);
    expect(result.isAvailable).toBe(false);
  });

  it('offers TransFi elsewhere', async () => {
    mockFetch.mockResolvedValue({ prohibitedCountries: ['TR'] });

    const result = await run();

    expect(result.isAvailable).toBe(true);
  });

  it('offers nothing while the dashboard list is still loading', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    const result = await run({ settle: false });

    expect(result.isResolving).toBe(true);
    expect(result.isAvailable).toBe(false);
  });

  it("falls back to the build's list when the dashboard list cannot be read", async () => {
    mockFetch.mockRejectedValue(new Error('offline'));

    const result = await run();

    expect(result.isResolving).toBe(false);
    expect(result.isAvailable).toBe(true);
    expect(result.isCountryProhibited('RU')).toBe(true);
  });
});
