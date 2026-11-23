/// <reference types="jest" />

import { toPerfSample } from '@/lib/telemetry/perfReporter';

jest.mock('@/lib/api', () => ({
  getJWTToken: () => null,
  getPlatformHeaders: () => ({}),
}));
// The real scope reads the user store, which needs native storage.
jest.mock('@/lib/accountScope', () => ({
  captureAccountScope: () => ({ generation: 0, isCurrent: () => true, assertCurrent: () => {} }),
}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '2.1.0' } }));
jest.mock('@/lib/telemetry/networkType', () => ({ getNetworkType: () => 'cellular' }));
jest.mock('@/lib/telemetry/perfClock', () => ({ getRunningUpdateId: () => 'a1b2c3d4-e5f6' }));

const NOW = new Date('2026-11-22T10:00:00.000Z');

describe('toPerfSample', () => {
  it('fills in identity, time, build and network', () => {
    const sample = toPerfSample({ kind: 'startup', launchKind: 'cold', homeReadyMs: 1234.4 }, NOW);
    expect(sample).toMatchObject({
      kind: 'startup',
      occurredAt: '2026-11-22T10:00:00.000Z',
      appVersion: '2.1.0',
      updateId: 'a1b2c3d4-e5f6',
      networkType: 'cellular',
      launchKind: 'cold',
      homeReadyMs: 1234,
    });
    // What the endpoint accepts as an id.
    expect(sample.id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('clamps what the endpoint would refuse instead of losing the batch', () => {
    const sample = toPerfSample(
      {
        kind: 'resume',
        sampleRate: 5,
        homeReadyMs: -20,
        freshMs: 9_999_999,
        backgroundMs: 40 * 24 * 60 * 60 * 1000,
        cacheRestored: 9_000,
        cacheOutcome: 'cache version\nforged=1',
        slowestGate: 'tokens',
        gateWaits: [
          { gate: 'tokens', ms: 12_000 },
          { gate: 'bad gate', ms: 1 },
        ],
        slowQueries: [{ key: 'tokenBalances', ms: Number.NaN }],
        tokenFetch: { totalMs: 15_000, failedChains: [8453, 0, -1], tokenCount: 12.7 },
      },
      NOW,
    );
    expect(sample).toMatchObject({
      sampleRate: 1,
      homeReadyMs: 0,
      freshMs: 3_600_000,
      backgroundMs: 30 * 24 * 60 * 60 * 1000,
      cacheRestored: 500,
      slowestGate: 'tokens',
      gateWaits: [{ gate: 'tokens', ms: 12_000 }],
      slowQueries: [],
      tokenFetch: { totalMs: 15_000, failedChains: [8453], tokenCount: 13 },
    });
    // A value that could forge a log line is left out entirely.
    expect(sample).not.toHaveProperty('cacheOutcome');
  });

  it('sends no keys for fields that were not measured', () => {
    const sample = toPerfSample({ kind: 'resume' }, NOW);
    expect(Object.keys(sample).sort()).toEqual(
      ['appVersion', 'id', 'kind', 'networkType', 'occurredAt', 'platform', 'updateId'].sort(),
    );
  });
});
