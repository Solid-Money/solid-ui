/// <reference types="jest" />

import { enqueueErrorEvent, isErrorIngestEnabled } from '@/lib/telemetry/errorIngestQueue';
import {
  buildClientErrorEvent,
  ERROR_FIELD_LIMITS,
  reportError,
  setCurrentScreen,
  truncateField,
} from '@/lib/telemetry/reportError';

jest.mock('@/lib/telemetry/errorIngestQueue', () => ({
  enqueueErrorEvent: jest.fn(),
  isErrorIngestEnabled: jest.fn(() => true),
}));
jest.mock('@amplitude/analytics-react-native', () => ({ getDeviceId: jest.fn(() => 'device-1') }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '2.0.2' }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '9.9.9' } },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '6f1c0e5e-1b2a-4c3d-8e4f-5a6b7c8d9e0f'),
}));

const mockEnqueue = enqueueErrorEvent as jest.MockedFunction<typeof enqueueErrorEvent>;
const mockEnabled = isErrorIngestEnabled as jest.MockedFunction<typeof isErrorIngestEnabled>;

const FAKE_KEY = 'pim_TestKey1234567890abc';

describe('buildClientErrorEvent', () => {
  afterEach(() => setCurrentScreen(undefined));

  it('fills in the device context', () => {
    setCurrentScreen('/deposit');
    const event = buildClientErrorEvent(
      { kind: 'api', message: 'Bad request', httpStatus: 400, endpoint: '/accounts/v1/deposits' },
      new Date('2026-10-08T10:00:00.000Z'),
    );

    expect(event).toEqual({
      id: '6f1c0e5e-1b2a-4c3d-8e4f-5a6b7c8d9e0f',
      ts: '2026-10-08T10:00:00.000Z',
      kind: 'api',
      message: 'Bad request',
      httpStatus: 400,
      endpoint: '/accounts/v1/deposits',
      screen: '/deposit',
      // jest-expo runs as iOS
      platform: 'ios',
      appVersion: '2.0.2',
      deviceId: 'device-1',
    });
    // Nothing undefined goes over the wire.
    expect(JSON.parse(JSON.stringify(event))).toEqual(event);
  });

  it('strips credentials from the message and from what the user saw', () => {
    const event = buildClientErrorEvent({
      kind: 'toast',
      message: `URL: https://api.pimlico.io/v2/122/rpc?apikey=${FAKE_KEY}`,
      userMessage: `Failed: Bearer abc.def.ghi`,
    });

    expect(event.message).not.toContain(FAKE_KEY);
    expect(event.message).toContain('apikey=[redacted]');
    expect(event.userMessage).toBe('Failed: Bearer [redacted]');
  });

  it('cuts every field to the contract limits', () => {
    const long = 'x'.repeat(5000);
    const event = buildClientErrorEvent({
      kind: 'flow',
      message: long,
      userMessage: long,
      step: long,
      code: long,
      endpoint: `/${long}`,
      screen: `/${long}`,
      claimedUsername: long,
    });

    expect(event.message).toHaveLength(ERROR_FIELD_LIMITS.message);
    expect(event.message.endsWith('…')).toBe(true);
    expect(event.userMessage).toHaveLength(ERROR_FIELD_LIMITS.userMessage);
    expect(event.step).toHaveLength(ERROR_FIELD_LIMITS.step);
    expect(event.code).toHaveLength(ERROR_FIELD_LIMITS.code);
    expect(event.endpoint).toHaveLength(ERROR_FIELD_LIMITS.endpoint);
    expect(event.screen).toHaveLength(ERROR_FIELD_LIMITS.screen);
    expect(event.claimedUsername).toHaveLength(ERROR_FIELD_LIMITS.claimedUsername);
  });

  it('redacts before cutting, so a cut can never expose part of a key', () => {
    const message = `${'x'.repeat(1990)} apikey=${FAKE_KEY}`;
    expect(buildClientErrorEvent({ kind: 'api', message }).message).not.toContain('pim_');
  });

  it('falls back to what the user saw, then to the kind, for the message', () => {
    expect(buildClientErrorEvent({ kind: 'toast', userMessage: 'Oops' }).message).toBe('Oops');
    expect(buildClientErrorEvent({ kind: 'crash', message: '   ' }).message).toBe('crash');
  });

  it('turns numeric codes into strings and drops empty refs', () => {
    const event = buildClientErrorEvent({
      kind: 'flow',
      message: 'm',
      code: 404,
      refs: { clientTxId: '', activityId: 'a-1' },
    });
    expect(event.code).toBe('404');
    expect(event.refs).toEqual({ activityId: 'a-1' });
    expect(buildClientErrorEvent({ kind: 'flow', message: 'm', refs: {} }).refs).toBeUndefined();
  });

  it('lets a caller name the screen', () => {
    setCurrentScreen('/home');
    expect(buildClientErrorEvent({ kind: 'crash', message: 'm', screen: '/card' }).screen).toBe(
      '/card',
    );
  });
});

describe('truncateField', () => {
  it('keeps short text, trims it and treats blank as absent', () => {
    expect(truncateField(' ok ', 10)).toBe('ok');
    expect(truncateField('   ', 10)).toBeUndefined();
    expect(truncateField(undefined, 10)).toBeUndefined();
    expect(truncateField('abcdef', 4)).toBe('abc…');
  });
});

describe('reportError', () => {
  beforeEach(() => {
    mockEnqueue.mockReset();
    mockEnabled.mockReturnValue(true);
  });

  it('queues the built event', () => {
    reportError({ kind: 'network', message: 'Network request failed', severity: 'warning' });
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'network', severity: 'warning' }),
    );
  });

  it('does nothing when ingest is off (dev builds, env switch)', () => {
    mockEnabled.mockReturnValue(false);
    reportError({ kind: 'network', message: 'Network request failed' });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('never throws', () => {
    mockEnqueue.mockImplementation(() => {
      throw new Error('broken');
    });
    expect(() => reportError({ kind: 'api', message: 'x' })).not.toThrow();
  });
});
