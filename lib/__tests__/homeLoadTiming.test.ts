/// <reference types="jest" />

import { AppState, AppStateStatus } from 'react-native';
import { QueryClient } from '@tanstack/react-query';

import type * as HomeLoadTimingModule from '@/lib/homeLoadTiming';

const mockTrack = jest.fn();
const mockReport = jest.fn();

jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('@/lib/telemetry/perfReporter', () => ({
  reportPerfSample: (...args: unknown[]) => mockReport(...args),
}));
jest.mock('@/lib/telemetry/networkType', () => ({
  watchNetworkType: jest.fn(),
  getNetworkType: () => 'wifi',
}));

const GATES_LOADING = {
  tokens: true,
  vaultBalance: true,
  savings: true,
  card: false,
  portfolio: true,
};
const GATES_CLEAR = {
  tokens: false,
  vaultBalance: false,
  savings: false,
  card: false,
  portfolio: false,
};

let appStateHandlers: ((status: AppStateStatus) => void)[] = [];

/** A fresh tracker, installed on a fresh query client, with AppState under the test's control. */
const load = () => {
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    handler: (status: AppStateStatus) => void,
  ) => {
    appStateHandlers.push(handler);
    return { remove: jest.fn() };
  }) as never);
  let timing!: typeof HomeLoadTimingModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    timing = require('@/lib/homeLoadTiming');
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const uninstall = timing.installHomeLoadTiming(queryClient);
  const setAppState = (status: AppStateStatus) =>
    appStateHandlers.forEach(handler => handler(status));
  return { ...timing, queryClient, uninstall, setAppState };
};

const eventsNamed = (name: string) =>
  mockTrack.mock.calls.filter(([event]) => event === name).map(([, props]) => props);

beforeEach(() => {
  jest.useFakeTimers();
  mockTrack.mockClear();
  mockReport.mockClear();
  (AppState as unknown as { currentState: string }).currentState = 'active';
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('launch', () => {
  it('says which part of the gate cleared last, and what the user looked at', () => {
    const { noteHomeGates, takeStartupLoadDetails, uninstall } = load();
    const splashHidden = performance.now();
    noteHomeGates(GATES_LOADING);
    jest.advanceTimersByTime(1_000);
    noteHomeGates({ ...GATES_LOADING, vaultBalance: false, savings: false });
    jest.advanceTimersByTime(11_000);
    noteHomeGates(GATES_CLEAR);

    const details = takeStartupLoadDetails(splashHidden);
    expect(details.skeletonShown).toBe(true);
    expect(details.snapshotShown).toBe(false);
    expect(details.slowestGate).toBe('tokens');
    expect(details.gateWaits).toEqual([
      { gate: 'tokens', ms: 12_000 },
      { gate: 'portfolio', ms: 12_000 },
      { gate: 'vaultBalance', ms: 1_000 },
      { gate: 'savings', ms: 1_000 },
    ]);
    uninstall();
  });

  it('records last-known figures standing in for skeletons, and their age', () => {
    const { noteHomeGates, takeStartupLoadDetails, uninstall } = load();
    noteHomeGates(GATES_LOADING, Date.now() - 3_600_000);
    noteHomeGates(GATES_CLEAR);
    const details = takeStartupLoadDetails();
    expect(details.snapshotShown).toBe(true);
    expect(details.skeletonShown).toBe(false);
    expect(details.snapshotAgeMs).toBe(3_600_000);
    uninstall();
  });
});

describe('return to the app', () => {
  it('reports how long balances took after a return, and what held them up', async () => {
    const { noteHomeGates, takeStartupLoadDetails, setAppState, uninstall } = load();
    noteHomeGates(GATES_CLEAR);
    takeStartupLoadDetails();

    setAppState('background');
    jest.advanceTimersByTime(5 * 60_000);
    setAppState('active');
    // The return drops the screen back to its gate (e.g. a query that has to load again).
    noteHomeGates({ ...GATES_CLEAR, tokens: true }, Date.now() - 60_000);
    jest.advanceTimersByTime(9_000);
    noteHomeGates(GATES_CLEAR);
    await jest.advanceTimersByTimeAsync(2_000);

    const [event] = eventsNamed('app_resume_timing');
    expect(event).toMatchObject({
      sample_rate: 1,
      background_ms: 5 * 60_000,
      home_mounted: true,
      home_ready_ms: 9_000,
      snapshot_shown: true,
      skeleton_shown: false,
      slowest_gate: 'tokens',
      timed_out: false,
    });
    expect(mockReport).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'resume', homeReadyMs: 9_000, slowestGate: 'tokens' }),
    );
    uninstall();
  });

  it('samples returns where nothing was slow', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const { noteHomeGates, takeStartupLoadDetails, setAppState, uninstall } = load();
    noteHomeGates(GATES_CLEAR);
    takeStartupLoadDetails();

    setAppState('background');
    jest.advanceTimersByTime(60_000);
    setAppState('active');
    await jest.advanceTimersByTimeAsync(2_000);

    expect(eventsNamed('app_resume_timing')).toHaveLength(0);
    expect(mockReport).not.toHaveBeenCalled();
    uninstall();
  });

  it('ignores a quick trip away', async () => {
    const { noteHomeGates, takeStartupLoadDetails, setAppState, uninstall } = load();
    noteHomeGates(GATES_CLEAR);
    takeStartupLoadDetails();
    setAppState('background');
    jest.advanceTimersByTime(5_000);
    setAppState('active');
    noteHomeGates({ ...GATES_CLEAR, tokens: true });
    await jest.advanceTimersByTimeAsync(70_000);
    expect(eventsNamed('app_resume_timing')).toHaveLength(0);
    uninstall();
  });

  it('times out a return that never finishes loading', async () => {
    const { noteHomeGates, takeStartupLoadDetails, setAppState, uninstall } = load();
    noteHomeGates(GATES_CLEAR);
    takeStartupLoadDetails();
    setAppState('background');
    jest.advanceTimersByTime(60_000);
    setAppState('active');
    noteHomeGates({ ...GATES_CLEAR, card: true });
    await jest.advanceTimersByTimeAsync(61_000);

    const [event] = eventsNamed('app_resume_timing');
    expect(event).toMatchObject({ timed_out: true, still_loading: true, skeleton_shown: true });
    uninstall();
  });
});

describe('slow queries', () => {
  it('names a balance query that took longer than 5 seconds', async () => {
    const { queryClient, uninstall } = load();
    const fetch = queryClient.fetchQuery({
      queryKey: ['tokenBalances', '0xabc'],
      queryFn: () => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 6_000)),
    });
    await jest.advanceTimersByTimeAsync(6_000);
    await fetch;

    expect(eventsNamed('slow_query')).toEqual([
      expect.objectContaining({ query: 'tokenBalances', duration_ms: 6_000, failed: false }),
    ]);
    uninstall();
  });

  it('leaves out queries the home screen does not wait on', async () => {
    const { queryClient, uninstall } = load();
    const fetch = queryClient.fetchQuery({
      queryKey: ['promotions-banner'],
      queryFn: () => new Promise(resolve => setTimeout(() => resolve([]), 9_000)),
    });
    await jest.advanceTimersByTimeAsync(9_000);
    await fetch;
    expect(eventsNamed('slow_query')).toHaveLength(0);
    uninstall();
  });
});
