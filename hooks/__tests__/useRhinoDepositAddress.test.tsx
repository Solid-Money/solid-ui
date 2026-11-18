import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useRhinoDepositAddress } from '@/hooks/useRhinoDepositAddress';
import { track } from '@/lib/analytics';
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

/** The Polygon row of the savings list. */
const SELECTION = {
  chain: 'MATIC_POS',
  chainId: 137,
  tokenSymbol: 'USDT',
  destinationType: 'PROTOCOL' as const,
};

const response = (depositAddress: string): RhinoDepositAddressResponse => ({
  depositAddress,
  chain: 'MATIC_POS',
  chainName: 'Polygon PoS',
  addressType: 'EVM',
  tokenSymbol: 'USDT',
  tokenAddress: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
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

const mount = async () => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const Probe = () => {
    seen.push(useRhinoDepositAddress(SELECTION));
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
  it('returns the address as it came', async () => {
    mockCreate.mockResolvedValue(response('0x8ba1f109551bD432803012645Ac136ddd64DBA72'));
    await mount();

    expect(latest().address?.depositAddress).toBe('0x8ba1f109551bD432803012645Ac136ddd64DBA72');
    expect(latest().isError).toBe(false);
  });

  // A Tron address for an EVM chain is one nothing on that chain can send to.
  it('treats an address in the wrong format for its chain as a failure', async () => {
    mockCreate.mockResolvedValue(response('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'));
    await mount();

    expect(latest().address).toBeUndefined();
    expect(latest().isError).toBe(true);
  });

  // A well-formed address for another route would be shown under this one's
  // instructions: a Bitcoin address for a Polygon row, say.
  it('treats an address for another chain, type, token or destination as a failure', async () => {
    const BITCOIN = 'bc1pwvza3f5hz85h9xdsmar8vjznsta9un82r5m5rvdsyys56u4xg75qytn3t4';
    const EVM = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
    const wrong: RhinoDepositAddressResponse[] = [
      { ...response(BITCOIN), addressType: 'BTC' },
      { ...response(EVM), chain: 'ETHEREUM' },
      { ...response(EVM), tokenSymbol: 'USDC' },
      { ...response(EVM), destinationType: 'WALLET' },
    ];
    for (const answer of wrong) {
      seen.length = 0;
      mockCreate.mockResolvedValue(answer);
      await mount();

      expect(latest().address).toBeUndefined();
      expect(latest().isError).toBe(true);
      await act(async () => root.unmount());
      client.clear();
    }
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

  // No screen falls back to an address of its own any more, so every failure is said.
  it('toasts every failure, with no option to stay quiet', async () => {
    mockCreate.mockRejectedValue({ status: 412 });
    await mount();

    expect(latest().isError).toBe(true);
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast.mock.calls[0][1]).toMatchObject({
      body: 'Finish setting up your wallet, then try again.',
    });
    expect(track).toHaveBeenCalledWith(
      TRACKING_EVENTS.DEPOSIT_RHINO_ADDRESS_FAILED,
      expect.not.objectContaining({ falls_back: expect.anything() }),
    );
  });

  it('retries on request, clearing the failure while the retry is out', async () => {
    mockCreate.mockRejectedValueOnce({ status: 503 });
    await mount();
    expect(latest().isError).toBe(true);

    mockCreate.mockResolvedValue(response('0x8ba1f109551bD432803012645Ac136ddd64DBA72'));
    await act(async () => {
      void latest().refetch();
    });
    await settle();

    expect(seen.some(result => result.isFetching && !result.isError)).toBe(true);
    expect(latest().address?.depositAddress).toBe('0x8ba1f109551bD432803012645Ac136ddd64DBA72');
  });
});
