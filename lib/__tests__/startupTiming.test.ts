/// <reference types="jest" />

import { QueryClient } from '@tanstack/react-query';

import { buildStartupTimingPayload, collectResolvedQueries } from '@/lib/startupTiming';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/mmvkStorage', () => () => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}));

const NATIVE = {
  startTime: 100,
  initializeRuntimeStart: 400,
  executeJavaScriptBundleEntryPointStart: 900,
};

describe('buildStartupTimingPayload', () => {
  it('splits a cold native launch into its phases', () => {
    const payload = buildStartupTimingPayload({
      marks: {
        firstLayout: 3_400,
        splashHidden: 3_450,
        homeMounted: 3_500,
        homeContentReady: 9_100,
      },
      native: NATIVE,
      queries: [
        { key: 'cardStatus', resolvedAt: 5_000, isError: false },
        { key: 'tokenBalances', resolvedAt: 9_050, isError: false },
        { key: 'vault', resolvedAt: 4_000, isError: true },
        // Settled after home was ready, so it can't have held the skeleton.
        { key: 'apys', resolvedAt: 12_000, isError: false },
      ],
      launchKind: 'cold',
      backgrounded: false,
      jsHeapMb: 180,
      restoredQueries: 9,
      isWeb: false,
    });

    expect(payload).toMatchObject({
      launch_kind: 'cold',
      native_startup_ms: 800,
      js_to_first_layout_ms: 2_500,
      first_layout_to_splash_hidden_ms: 50,
      splash_to_home_ready_ms: 5_650,
      home_mounted_after_splash_ms: 50,
      total_to_home_ready_ms: 9_000,
      gating_query: 'tokenBalances',
      gating_query_ms: 8_950,
      gating_query_failed: false,
      queries_settled: 3,
      queries_failed: 1,
      js_heap_mb: 180,
      cache_restored_queries: 9,
    });
  });

  it('counts from navigation start on web, where there is no native timing', () => {
    const payload = buildStartupTimingPayload({
      marks: { firstLayout: 1_200, splashHidden: 1_210, homeContentReady: 4_000 },
      native: null,
      queries: [],
      launchKind: 'page_load',
      backgrounded: false,
      isWeb: true,
    });

    expect(payload.total_to_home_ready_ms).toBe(4_000);
    expect(payload.native_startup_ms).toBeUndefined();
    expect(payload.js_to_first_layout_ms).toBeUndefined();
    expect(payload.gating_query).toBeUndefined();
  });

  it('leaves the total unset on native when the platform gave no start time', () => {
    const payload = buildStartupTimingPayload({
      marks: { splashHidden: 1_000, homeContentReady: 2_000 },
      native: null,
      queries: [],
      launchKind: 'cold',
      backgrounded: true,
      isWeb: false,
    });

    expect(payload.total_to_home_ready_ms).toBeUndefined();
    expect(payload.splash_to_home_ready_ms).toBe(1_000);
    expect(payload.backgrounded_during_startup).toBe(true);
  });
});

describe('buildStartupTimingPayload with a restored cache', () => {
  it('ignores data that was fetched before this launch began', () => {
    const payload = buildStartupTimingPayload({
      marks: { firstLayout: 3_400, splashHidden: 3_450, homeContentReady: 3_480 },
      native: NATIVE,
      queries: [
        // Restored from the persisted cache: fetched yesterday.
        { key: 'tokenBalances', resolvedAt: -86_400_000, isError: false },
        { key: 'cardStatus', resolvedAt: 50, isError: false },
      ],
      launchKind: 'cold',
      backgrounded: false,
      restoredQueries: 12,
      isWeb: false,
    });

    expect(payload.gating_query).toBeUndefined();
    expect(payload.queries_settled).toBe(0);
    expect(payload.splash_to_home_ready_ms).toBe(30);
    expect(payload.cache_restored_queries).toBe(12);
  });
});

describe('collectResolvedQueries', () => {
  it('puts React Query wall-clock stamps on the performance clock', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ['tokenBalances', '0xabc'],
      { ok: true },
      { updatedAt: 1_700_000_005_000 },
    );
    queryClient.getQueryCache().build(queryClient, { queryKey: ['neverFetched'] });

    // performance.now() = 6_000 at wall clock 1_700_000_010_000
    const queries = collectResolvedQueries(queryClient, 1_700_000_010_000, 6_000);

    expect(queries).toEqual([{ key: 'tokenBalances', resolvedAt: 1_000, isError: false }]);
    queryClient.clear();
  });
});
