/// <reference types="jest" />

import { isCriticalUpdate } from '@/hooks/useOtaUpdate';

import type { UpdateInfo } from 'expo-updates';

jest.mock('expo-updates', () => ({ useUpdates: jest.fn(), isEnabled: true }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/startupTiming', () => ({ markOtaReloadRequested: jest.fn() }));

const update = (extra: Record<string, unknown> | undefined) =>
  ({
    type: 'new',
    updateId: 'u-1',
    createdAt: new Date(),
    manifest: { id: 'u-1', extra: { expoClient: { name: 'Solid', slug: 'solid', extra } } },
  }) as unknown as UpdateInfo;

const CRITICAL_AT = '2026-10-13T12:00:00Z';

describe('isCriticalUpdate', () => {
  it('prompts a device running a bundle published before the critical one', () => {
    const runningSince = new Date('2026-10-12T09:00:00Z');
    expect(isCriticalUpdate(update({ otaCriticalSince: CRITICAL_AT }), runningSince)).toBe(true);
  });

  it('still prompts when a routine update published later is the one downloaded', () => {
    // Published after the critical one, carrying the same marker.
    const later = update({ otaCriticalSince: CRITICAL_AT });
    expect(isCriticalUpdate(later, new Date('2026-10-12T09:00:00Z'))).toBe(true);
  });

  it('does not prompt a device already running the critical fix', () => {
    const runningSince = new Date('2026-10-13T12:05:00Z');
    expect(isCriticalUpdate(update({ otaCriticalSince: CRITICAL_AT }), runningSince)).toBe(false);
  });

  it('treats the bundle built into the binary as older than any update', () => {
    expect(isCriticalUpdate(update({ otaCriticalSince: CRITICAL_AT }), null)).toBe(true);
  });

  it('leaves routine updates for the next cold launch', () => {
    const runningSince = new Date('2026-10-12T09:00:00Z');
    expect(isCriticalUpdate(update({ otaCriticalSince: null }), runningSince)).toBe(false);
    // Updates published before the marker existed carry no such field.
    expect(isCriticalUpdate(update({ router: {} }), runningSince)).toBe(false);
    expect(isCriticalUpdate(update(undefined), runningSince)).toBe(false);
    expect(isCriticalUpdate(update({ otaCriticalSince: 'not a date' }), runningSince)).toBe(false);
  });

  it('handles a rollback or a missing update', () => {
    expect(isCriticalUpdate(undefined, null)).toBe(false);
    expect(
      isCriticalUpdate({ type: 'rollback', manifest: undefined } as unknown as UpdateInfo, null),
    ).toBe(false);
  });
});
