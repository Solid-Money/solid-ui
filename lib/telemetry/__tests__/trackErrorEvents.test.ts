/// <reference types="jest" />

import { track as amplitudeTrack } from '@amplitude/analytics-react-native';

import { track } from '@/lib/analytics';
import { isErrorIngestEnabled } from '@/lib/telemetry/errorIngestQueue';

jest.mock('@amplitude/analytics-react-native', () => ({
  add: jest.fn(),
  getDeviceId: jest.fn(() => 'device-1'),
  getSessionId: jest.fn(() => 1),
  Identify: jest.fn(),
  identify: jest.fn(),
  init: jest.fn(),
  setUserId: jest.fn(),
  track: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {} }));
jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(),
  logEvent: jest.fn(),
  setUserId: jest.fn(),
  setUserProperties: jest.fn(),
}));
jest.mock('@react-native-firebase/app', () => ({
  getApps: () => [],
  initializeApp: jest.fn(),
  setReactNativeAsyncStorage: jest.fn(),
}));
jest.mock('@/lib/gtm', () => ({ trackGTMEvent: jest.fn() }));
jest.mock('@/lib/attribution', () => ({ getAttributionChannel: () => 'direct' }));
jest.mock('@/store/useAttributionStore', () => ({
  useAttributionStore: { getState: () => ({ getAttributionForEvent: () => ({}) }) },
}));
jest.mock('@/lib/utils/utils', () => ({
  sanitize: (value: unknown) => value,
  toTitleCase: (word: string) => word.charAt(0).toUpperCase() + word.slice(1),
}));
jest.mock('@/lib/telemetry/errorIngestQueue', () => ({
  isErrorIngestEnabled: jest.fn(() => true),
}));

const mockAmplitudeTrack = amplitudeTrack as jest.MockedFunction<typeof amplitudeTrack>;
const mockIngestEnabled = isErrorIngestEnabled as jest.MockedFunction<typeof isErrorIngestEnabled>;

const sentProps = () => mockAmplitudeTrack.mock.calls[0]?.[1] as Record<string, unknown>;

describe('track() → Errors page flag', () => {
  const dev = (global as any).__DEV__;

  beforeEach(() => {
    (global as any).__DEV__ = false;
    mockAmplitudeTrack.mockClear();
    mockIngestEnabled.mockReturnValue(true);
  });

  afterEach(() => {
    (global as any).__DEV__ = dev;
  });

  it('flags a failure event so the Errors page does not import it twice', () => {
    track('deposit_error', { error: 'boom' });
    expect(mockAmplitudeTrack).toHaveBeenCalledWith(
      'Deposit Error',
      expect.objectContaining({ error: 'boom', errors_reported_live: true }),
    );
  });

  it('leaves other events alone', () => {
    track('deposit_completed', {});
    expect(sentProps()).not.toHaveProperty('errors_reported_live');
  });

  it('does not flag when this build is not reporting', () => {
    mockIngestEnabled.mockReturnValue(false);
    track('swap_failed', {});
    expect(sentProps()).not.toHaveProperty('errors_reported_live');
  });

  it('never changes the caller’s params', () => {
    const params = { error: 'boom' };
    track('send_failed', params);
    expect(params).toEqual({ error: 'boom' });
  });
});
