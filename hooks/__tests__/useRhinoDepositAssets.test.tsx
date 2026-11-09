import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fuse, mainnet, polygon } from 'viem/chains';

import { useOfferedRhinoDepositAssets, useRhinoNetworkRows } from '@/hooks/useRhinoDepositAssets';
import { RHINO_ASSETS } from '@/lib/__tests__/rhinoFixtures';
import { getRhinoDepositAssets } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api', () => ({ getRhinoDepositAssets: jest.fn() }));
// Outside the new-deposit-tokens rollout, which must not stand between anyone
// and rhino.fi.
jest.mock('@/hooks/useDepositTokensAccess', () => ({
  useDepositTokensAccess: () => ({ isEnabled: false, isLoading: false }),
}));

const mockGetAssets = getRhinoDepositAssets as jest.MockedFunction<typeof getRhinoDepositAssets>;

const ROWS = [{ chainId: mainnet.id }, { chainId: polygon.id }, { chainId: fuse.id }];

type Seen = {
  offered: ReturnType<typeof useOfferedRhinoDepositAssets>;
  rows: ReturnType<typeof useRhinoNetworkRows<{ chainId: number }>>;
};

/** Every answer the hooks gave; the last is the current one. */
const seen: Seen[] = [];
const latest = () => seen[seen.length - 1];
let root: any;
let client: QueryClient;

const mount = async () => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const Probe = () => {
    seen.push({
      offered: useOfferedRhinoDepositAssets(),
      // ETH into soETH: rhino.fi takes it from Ethereum, not from Polygon.
      rows: useRhinoNetworkRows(
        { destinationType: 'PROTOCOL', symbol: 'ETH', vault: 'soETH' },
        ROWS,
      ),
    });
    return null;
  };
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
};

/** Lets the query settle, for as long as its one retry takes. */
const settleUntil = async (done: () => boolean, timeoutMs = 3000) => {
  const start = Date.now();
  while (!done() && Date.now() - start < timeoutMs) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
  }
};

const kinds = () => latest().rows.rows.map(({ state }) => state.kind);

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  seen.length = 0;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  client?.clear();
});

describe('useOfferedRhinoDepositAssets', () => {
  it('is fetched for everyone, and ready once rhino.fi is on', async () => {
    mockGetAssets.mockResolvedValue(RHINO_ASSETS);
    await mount();
    expect(seen[0].offered.status).toBe('loading');

    await settleUntil(() => latest().offered.status === 'ready');
    expect(mockGetAssets).toHaveBeenCalled();
    expect(latest().offered).toMatchObject({ status: 'ready', assets: RHINO_ASSETS });
  });

  // The backend answers `enabled: false` without a rhino.fi key: not a failure,
  // and not asked again, since the answer would be the same.
  it('is disabled when the backend has rhino.fi off', async () => {
    mockGetAssets.mockResolvedValue({ enabled: false, chains: [] });
    await mount();
    await settleUntil(() => latest().offered.status === 'disabled');

    expect(latest().offered.status).toBe('disabled');
    expect(latest().offered.assets).toBeUndefined();
    expect(mockGetAssets).toHaveBeenCalledTimes(1);
  });

  // A backend from before rhino.fi has no such endpoint.
  it('is disabled when the backend has no rhino.fi endpoint', async () => {
    mockGetAssets.mockRejectedValue({ status: 404 });
    await mount();
    await settleUntil(() => latest().offered.status === 'disabled');

    expect(latest().offered.status).toBe('disabled');
  });

  it('is unavailable when the request fails, and asks again on retry', async () => {
    mockGetAssets.mockRejectedValue(new Error('down'));
    await mount();
    await settleUntil(() => latest().offered.status === 'unavailable');

    expect(latest().offered.status).toBe('unavailable');
    expect(latest().offered.assets).toBeUndefined();
    // Asked twice: once, and the one retry.
    expect(mockGetAssets).toHaveBeenCalledTimes(2);

    mockGetAssets.mockResolvedValue(RHINO_ASSETS);
    await act(async () => latest().offered.retry());
    await settleUntil(() => latest().offered.status === 'ready');

    expect(seen.map(item => item.offered.status)).toContain('loading');
    expect(latest().offered.status).toBe('ready');
  });
});

describe('useRhinoNetworkRows', () => {
  it('keeps Fuse our own while every other row waits for the routes', async () => {
    mockGetAssets.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(kinds()).toEqual(['loading', 'loading', 'own']);
  });

  it('serves the rows rhino.fi has a route from, and offers no other', async () => {
    mockGetAssets.mockResolvedValue(RHINO_ASSETS);
    await mount();
    await settleUntil(() => latest().offered.status === 'ready');

    expect(kinds()).toEqual(['rhino', 'none', 'own']);
    expect(latest().rows.rows[0].state).toMatchObject({
      selection: { chain: 'ETHEREUM', chainId: mainnet.id, vault: 'soETH' },
    });
  });

  it('marks every row but Fuse’s unavailable when the routes cannot be had', async () => {
    mockGetAssets.mockRejectedValue(new Error('down'));
    await mount();
    await settleUntil(() => latest().offered.status === 'unavailable');

    expect(kinds()).toEqual(['unavailable', 'unavailable', 'own']);
  });

  // As before rhino.fi: every row our own pipeline's, Polygon included.
  it('serves every row as our own while rhino.fi is off', async () => {
    mockGetAssets.mockResolvedValue({ enabled: false, chains: [] });
    await mount();
    await settleUntil(() => latest().offered.status === 'disabled');

    expect(kinds()).toEqual(['own', 'own', 'own']);
  });
});
