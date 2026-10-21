import React from 'react';
import Toast from 'react-native-toast-message';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Country } from '@/constants/countries';
import { useConfirmResidence } from '@/hooks/useConfirmResidence';
import { getWirexBankOverview } from '@/lib/api';
import { checkProductAccess } from '@/lib/countryAccess';
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

jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock('@/lib/api', () => ({ getWirexBankOverview: jest.fn() }));
jest.mock('@/lib/countryAccess', () => ({ checkProductAccess: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));

const mockOverview = getWirexBankOverview as jest.MockedFunction<typeof getWirexBankOverview>;
const mockCardAccess = checkProductAccess as jest.MockedFunction<typeof checkProductAccess>;

const FRANCE = { code: 'FR', name: 'France' } as Country;
const PAKISTAN = { code: 'PK', name: 'Pakistan' } as Country;

type Result = ReturnType<typeof useConfirmResidence>;

/** Render the hook and hand back its latest value. */
const renderHook = async (): Promise<() => Result> => {
  const seen: Result[] = [];
  const Probe = () => {
    seen.push(useConfirmResidence());
    return null;
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  return () => seen[seen.length - 1];
};

describe('useConfirmResidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCountryStore.getState().clearCountryInfo();
    mockCardAccess.mockResolvedValue(true);
  });

  it('routes an IBAN country to Wirex, on the country the user named', async () => {
    mockOverview.mockResolvedValue({ provider: 'wirex' } as never);
    const latest = await renderHook();

    let routed: string | null = null;
    await act(async () => {
      routed = await latest().confirmResidence(FRANCE);
    });

    expect(routed).toBe('wirex');
    expect(mockOverview).toHaveBeenCalledWith('FR');
  });

  it('routes anywhere else to Rain', async () => {
    mockOverview.mockResolvedValue({ provider: 'rain' } as never);
    const latest = await renderHook();

    let routed: string | null = null;
    await act(async () => {
      routed = await latest().confirmResidence(PAKISTAN);
    });

    expect(routed).toBe('rain');
  });

  it('remembers the answer as picked by hand, so nothing asks again', async () => {
    mockOverview.mockResolvedValue({ provider: 'wirex' } as never);
    mockCardAccess.mockResolvedValue(false);
    const latest = await renderHook();

    await act(async () => {
      await latest().confirmResidence(FRANCE);
    });

    expect(useCountryStore.getState().countryInfo).toMatchObject({
      countryCode: 'FR',
      source: 'manual',
      // The store's `isAvailable` is the card's answer for that country.
      isAvailable: false,
    });
  });

  it('reports a failed lookup and resolves to null', async () => {
    mockOverview.mockRejectedValue(new Error('offline'));
    const latest = await renderHook();

    let routed: string | null = 'unset';
    await act(async () => {
      routed = await latest().confirmResidence(FRANCE);
    });

    expect(routed).toBeNull();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: "Couldn't check your country" }),
    );
    expect(latest().isConfirming).toBe(false);
  });
});
