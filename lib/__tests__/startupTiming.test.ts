/// <reference types="jest" />

import { QueryClient } from '@tanstack/react-query';

import { buildStartupTimingPayload, collectResolvedQueries } from '@/lib/startupTiming';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/telemetry/perfReporter', () => ({ reportPerfSample: jest.fn() }));
jest.mock('@/lib/homeLoadTiming', () => ({ takeStartupLoadDetails: jest.fn() }));
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

describe('buildStartupTimingPayload across clocks', () => {
  it('drops spans that crossed clocks instead of reporting a days-long launch', () => {
    // iOS: the native start times are on another base than performance.now().
    const payload = buildStartupTimingPayload({
      marks: { firstLayout: 334_308_000, splashHidden: 334_308_100, homeContentReady: 334_326_800 },
      native: { startTime: 0, executeJavaScriptBundleEntryPointStart: 0 },
      queries: [],
      launchKind: 'cold',
      backgrounded: true,
      isWeb: false,
      jsStart: 334_300_000,
      firstActive: 334_307_900,
      startedInBackground: true,
    });

    expect(payload.total_to_home_ready_ms).toBeUndefined();
    expect(payload.js_to_first_layout_ms).toBeUndefined();
    expect(payload.native_timing_invalid).toBe(true);
    // Same-clock spans are kept.
    expect(payload.splash_to_home_ready_ms).toBe(18_700);
    expect(payload.js_to_home_ready_ms).toBe(26_800);
    expect(payload.visible_to_home_ready_ms).toBe(18_900);
    expect(payload.started_in_background).toBe(true);
  });

  it('counts the visible wait as 0 when balances were ready before the app came to the front', () => {
    const payload = buildStartupTimingPayload({
      marks: { splashHidden: 100, homeContentReady: 900 },
      native: null,
      queries: [],
      launchKind: 'cold',
      backgrounded: false,
      isWeb: false,
      jsStart: 0,
      firstActive: 5_000,
    });
    expect(payload.visible_to_home_ready_ms).toBe(0);
  });

  it('reports why the cache was or was not restored, and what the launch waited on', () => {
    const payload = buildStartupTimingPayload({
      marks: { splashHidden: 1_000, homeContentReady: 49_100 },
      native: null,
      queries: [],
      launchKind: 'cold',
      backgrounded: false,
      isWeb: false,
      jsStart: 0,
      cacheInfo: {
        outcome: 'restored',
        restored: 26,
        droppedFamilies: ['tierMembership'],
        droppedExpired: 0,
        newestAgeMs: 3_600_000,
      },
      load: {
        skeletonShown: false,
        snapshotShown: true,
        snapshotAgeMs: 3_600_000,
        gateWaits: [
          { gate: 'tokens', ms: 48_100 },
          { gate: 'card', ms: 900 },
        ],
        slowestGate: 'tokens',
        slowQueries: [{ key: 'tokenBalances', ms: 47_000, failed: false }],
        tokenFetch: {
          totalMs: 47_000,
          readsMs: 40_000,
          pricingMs: 7_000,
          tokenCount: 28,
          unpricedCount: 2,
          timedOutReads: 1,
          failedChains: [137],
          slowestChain: 8453,
          slowestChainMs: 15_000,
        },
        authRefreshMs: 140,
        startedAt: 0,
      },
      updateId: 'abc-123',
    });

    expect(payload).toMatchObject({
      cache_outcome: 'restored',
      cache_dropped_families: 'tierMembership',
      snapshot_shown: true,
      skeleton_shown: false,
      slowest_gate: 'tokens',
      gate_waits: { tokens: 48_100, card: 900 },
      slow_queries: 'tokenBalances:47000',
      token_fetch_ms: 47_000,
      token_failed_chains: '137',
      auth_refresh_ms: 140,
      update_id: 'abc-123',
    });
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
