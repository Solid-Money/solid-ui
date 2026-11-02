import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useRhinoDepositAddress } from '@/hooks/useRhinoDepositAddress';
import { createRhinoDepositAddress } from '@/lib/api';
import { showErrorToast } from '@/lib/errors';

import type { RhinoDepositAddressResponse } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api', () => ({ createRhinoDepositAddress: jest.fn() }));
jest.mock('@/lib/errors', () => ({ showErrorToast: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (call: () => unknown) => call() }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { userId: 'user-1' } }),
}));

const mockCreate = createRhinoDepositAddress as jest.MockedFunction<
  typeof createRhinoDepositAddress
>;
const mockToast = showErrorToast as jest.MockedFunction<typeof showErrorToast>;

const SELECTION = { chain: 'TRON', tokenSymbol: 'USDT', destinationType: 'PROTOCOL' as const };

const response = (depositAddress: string): RhinoDepositAddressResponse => ({
  depositAddress,
  chain: 'TRON',
  chainName: 'Tron',
  addressType: 'TRON',
  tokenSymbol: 'USDT',
  tokenAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  destinationType: 'PROTOCOL',
  receiveSymbol: 'USDC',
  receiveChainId: 8453,
  vault: 'soUSD',
  minimumUsd: 5,
  maximumUsd: 100000,
});

const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

/** Every answer the hook gave; the last is the current one. */
const seen: ReturnType<typeof useRhinoDepositAddress>[] = [];
const latest = () => seen[seen.length - 1];
let root: any;
let client: QueryClient;

const mount = async (options?: { notifyOnError?: boolean }) => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const Probe = () => {
    seen.push(useRhinoDepositAddress(SELECTION, options));
    return null;
  };
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await settle();
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  seen.length = 0;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  client?.clear();
});

describe('useRhinoDepositAddress', () => {
  it('returns a Tron address as it came', async () => {
    mockCreate.mockResolvedValue(response('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'));
    await mount();

    expect(latest().address?.depositAddress).toBe('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE');
    expect(latest().isError).toBe(false);
  });

  // A 0x address for Tron is one nothing on Tron can send to.
  it('treats an address in the wrong format for its chain as a failure', async () => {
    mockCreate.mockResolvedValue(response('0x8ba1f109551bD432803012645Ac136ddd64DBA72'));
    await mount();

    expect(latest().address).toBeUndefined();
    expect(latest().isError).toBe(true);
  });

  it('toasts a failure, with the reason the status gives', async () => {
    mockCreate.mockRejectedValue({ status: 503 });
    await mount();

    expect(latest().isError).toBe(true);
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast.mock.calls[0][1]).toMatchObject({
      body: 'This network isn’t available right now. Try again later.',
    });
  });

  it('stays quiet for a screen that falls back to its own address', async () => {
    mockCreate.mockRejectedValue({ status: 412 });
    await mount({ notifyOnError: false });

    expect(latest().isError).toBe(true);
    expect(mockToast).not.toHaveBeenCalled();
  });
});
