import React from 'react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
/** No garbage-collection timer, so a finished run leaves nothing for Jest to wait on. */
const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

const run = async ({ settle = true, client = newClient() } = {}): Promise<Availability> => {
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
  // Inside act, so the query's unsubscribe lands now rather than in the middle
  // of a check the test makes next (it cancels that check's pending retry).
  await act(async () => {
    root.unmount();
  });
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
  afterEach(() => {
    jest.useRealTimers();
    onlineManager.setOnline(true);
  });

  it('hides TransFi in a country closed on the dashboard', async () => {
    mockCountry.countryCode = 'TR';
    mockFetch.mockResolvedValue({ prohibitedCountries: ['tr', 'ID'] });

    const result = await run();

    expect(result.isResolving).toBe(false);
    expect(result.isAvailable).toBe(false);
    await expect(result.checkCountryProhibited('id')).resolves.toBe(true);
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

  it('offers nothing while the first read waits for the device to come online', async () => {
    mockFetch.mockResolvedValue({ prohibitedCountries: [] });
    onlineManager.setOnline(false);

    const result = await run({ settle: false });

    expect(result.isResolving).toBe(true);
    expect(result.isAvailable).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
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
    await expect(result.checkCountryProhibited('RU')).resolves.toBe(true);
    await expect(result.checkCountryProhibited('TR')).resolves.toBe(false);
  });

  /** The app's client retries twice by default; the check waits on this one. */
  it('asks once more, not twice, when checking a confirmed country fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: 2, gcTime: Infinity } } });

    const result = await run({ client });
    mockFetch.mockClear();
    await result.checkCountryProhibited('TR');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  /**
   * The EUR row's residence step can be confirmed before the dashboard list
   * lands; the confirmed country must still be checked against it.
   */
  it('checks a confirmed country against a list that was still loading', async () => {
    let land: (value: { prohibitedCountries: string[] }) => void = () => {};
    mockFetch.mockReturnValue(
      new Promise(resolve => {
        land = resolve;
      }),
    );

    const result = await run({ settle: false });
    expect(result.isResolving).toBe(true);

    const check = result.checkCountryProhibited('TR');
    land({ prohibitedCountries: ['TR'] });

    await expect(check).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  describe('with a list read more than five minutes ago', () => {
    const staleClient = (prohibitedCountries: string[]) => {
      const client = newClient();
      client.setQueryData(
        ['transfi-prohibited-countries'],
        { prohibitedCountries },
        { updatedAt: Date.now() - 10 * 60 * 1000 },
      );
      return client;
    };

    it('checks a confirmed country against the refresh, not the old list', async () => {
      let land: (value: { prohibitedCountries: string[] }) => void = () => {};
      mockFetch.mockReturnValue(
        new Promise(resolve => {
          land = resolve;
        }),
      );

      const result = await run({ settle: false, client: staleClient([]) });

      const check = result.checkCountryProhibited('TR');
      land({ prohibitedCountries: ['TR'] });

      await expect(check).resolves.toBe(true);
    });

    it('offers nothing while the list is being read again', async () => {
      mockFetch.mockReturnValue(new Promise(() => {}));

      const result = await run({ settle: false, client: staleClient([]) });

      expect(result.isResolving).toBe(true);
      expect(result.isAvailable).toBe(false);
    });

    /** A read paused while offline never starts, so its own timeout never runs. */
    it('stops waiting for a read that does not settle and uses the old list', async () => {
      mockFetch.mockReturnValue(new Promise(() => {}));
      const result = await run({ settle: false, client: staleClient(['TR']) });

      jest.useFakeTimers();
      const check = result.checkCountryProhibited('TR');
      await jest.advanceTimersByTimeAsync(10_000);

      await expect(check).resolves.toBe(true);
    });

    it('keeps the old list when the refresh fails', async () => {
      mockFetch.mockRejectedValue(new Error('offline'));

      const result = await run({ client: staleClient(['TR']) });

      await expect(result.checkCountryProhibited('TR')).resolves.toBe(true);
    });
  });
});
