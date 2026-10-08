/// <reference types="jest" />

import { track } from '@/lib/analytics';
import { reportError } from '@/lib/telemetry/reportError';

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
jest.mock('@/lib/telemetry/reportError', () => ({ reportError: jest.fn() }));

const mockReportError = reportError as jest.MockedFunction<typeof reportError>;

describe('track() → Errors page', () => {
  const dev = (global as any).__DEV__;

  beforeEach(() => {
    (global as any).__DEV__ = false;
    mockReportError.mockClear();
  });

  afterEach(() => {
    (global as any).__DEV__ = dev;
  });

  it('mirrors an error event with its Amplitude name and the call-site params', () => {
    track('deposit_error', { error: 'boom', clientTxId: 'tx-1' });
    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'flow',
        flow: 'deposit',
        amplitudeEvent: 'Deposit Error',
        message: 'boom',
        refs: { clientTxId: 'tx-1' },
      }),
    );
  });

  it('still mirrors it when Amplitude is opted out for that event', () => {
    track('card_activation_failed', { error: 'boom' }, { amplitude: false });
    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({ amplitudeEvent: 'Card Activation Failed', flow: 'card' }),
    );
  });

  it('leaves error_boundary to the boundary, so a crash is reported once', () => {
    track('error_boundary', { message: 'boom' });
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('ignores events that are not failures', () => {
    track('deposit_completed', {});
    track('deposit_cancelled', {});
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('sends nothing from a dev build', () => {
    (global as any).__DEV__ = true;
    track('deposit_error', { error: 'boom' });
    expect(mockReportError).not.toHaveBeenCalled();
  });
});
