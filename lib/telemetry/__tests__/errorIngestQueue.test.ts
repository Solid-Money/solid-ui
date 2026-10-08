/// <reference types="jest" />

import { AppState } from 'react-native';

import {
  __getQueuedErrorEvents,
  __resetErrorIngestQueue,
  enqueueErrorEvent,
  ERROR_INGEST_URL,
  FLUSH_INTERVAL_MS,
  isErrorIngestEnabled,
  MAX_QUEUED,
  RETRY_DELAY_MS,
} from '@/lib/telemetry/errorIngestQueue';

import type { ClientErrorEvent } from '@/lib/telemetry/types';

jest.mock('@/lib/api', () => ({
  getPlatformHeaders: () => ({ 'X-Platform': 'mobile' }),
  getJWTToken: () => 'access-token',
}));
jest.mock('@/lib/config', () => ({
  EXPO_PUBLIC_FLASH_API_BASE_URL: 'https://api.test',
  EXPO_PUBLIC_ERRORS_INGEST_ENABLED: true,
}));

let counter = 0;
const event = (overrides: Partial<ClientErrorEvent> = {}): ClientErrorEvent => {
  counter += 1;
  return {
    id: `id-${counter}`,
    ts: '2026-10-08T10:00:00.000Z',
    kind: 'api',
    message: `failure ${counter}`,
    platform: 'ios',
    ...overrides,
  };
};

const respond = (status: number) => ({ ok: status >= 200 && status < 300, status }) as Response;

const sentBatches = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).events as ClientErrorEvent[]);

describe('errorIngestQueue', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetErrorIngestQueue();
    fetchMock = jest.fn(() => Promise.resolve(respond(202)));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    __resetErrorIngestQueue();
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('sends what was queued as one batch after the flush interval, with the app auth', async () => {
    enqueueErrorEvent(event());
    enqueueErrorEvent(event());
    expect(fetchMock).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/accounts/v1/errors/ingest');
    expect(url).toBe(ERROR_INGEST_URL);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Platform': 'mobile',
        Authorization: 'Bearer access-token',
      },
    });
    expect(sentBatches(fetchMock)[0]).toHaveLength(2);
    expect(__getQueuedErrorEvents()).toHaveLength(0);
  });

  it('sends straight away once 20 events are waiting', async () => {
    for (let i = 0; i < 20; i += 1) enqueueErrorEvent(event());
    await jest.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBatches(fetchMock)[0]).toHaveLength(20);
  });

  it('never sends more than 50 events in one request', async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>(resolve => (release = () => resolve(respond(202)))),
    );

    // 20 start a flush; the next 100 queue up behind the request in flight.
    for (let i = 0; i < 120; i += 1) enqueueErrorEvent(event());
    release();
    await jest.advanceTimersByTimeAsync(0);

    expect(sentBatches(fetchMock).map(batch => batch.length)).toEqual([20, 50, 50]);
  });

  it('keeps at most 200 events, dropping the oldest', async () => {
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}));
    for (let i = 0; i < 20; i += 1) enqueueErrorEvent(event()); // in flight
    const queued = Array.from({ length: 250 }, () => event());
    queued.forEach(enqueueErrorEvent);

    const waiting = __getQueuedErrorEvents();
    expect(waiting).toHaveLength(MAX_QUEUED);
    expect(waiting[0].id).toBe(queued[50].id);
    expect(waiting[MAX_QUEUED - 1].id).toBe(queued[249].id);
  });

  it('sends an identical event once within 5 seconds', async () => {
    const same = { kind: 'api' as const, code: 'E1', message: 'Boom', endpoint: '/a' };

    expect(enqueueErrorEvent(event(same))).toBe(true);
    expect(enqueueErrorEvent(event(same))).toBe(false);
    // A different endpoint is a different failure.
    expect(enqueueErrorEvent(event({ ...same, endpoint: '/b' }))).toBe(true);

    await jest.advanceTimersByTimeAsync(5_000);
    expect(enqueueErrorEvent(event(same))).toBe(true);
  });

  it('retries a failed batch once, then drops it', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Network request failed')));
    enqueueErrorEvent(event());

    await jest.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(__getQueuedErrorEvents()).toHaveLength(0);
  });

  it('retries a server error, but not a rejected batch', async () => {
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(respond(503)))
      .mockImplementationOnce(() => Promise.resolve(respond(202)));
    enqueueErrorEvent(event());
    await jest.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS + RETRY_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    fetchMock.mockImplementation(() => Promise.resolve(respond(400)));
    enqueueErrorEvent(event());
    await jest.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS + RETRY_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resends a 401 straight away without credentials instead of refreshing', async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(respond(401)));
    enqueueErrorEvent(event());
    await jest.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, anonymous] = fetchMock.mock.calls[1];
    expect(anonymous.credentials).toBe('omit');
    expect(anonymous.headers.Authorization).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].body).toBe(anonymous.body);
  });

  it('flushes when the app goes to the background', async () => {
    enqueueErrorEvent(event());
    const onChange = (AppState.addEventListener as jest.Mock).mock.calls.find(
      ([type]) => type === 'change',
    )?.[1];
    expect(onChange).toBeDefined();

    onChange('background');
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never throws, whatever fetch does', async () => {
    fetchMock.mockImplementation(() => {
      throw new Error('sync failure');
    });
    expect(() => enqueueErrorEvent(event())).not.toThrow();
    await expect(jest.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS + RETRY_DELAY_MS)).resolves.toBe(
      undefined,
    );
  });
});

describe('isErrorIngestEnabled', () => {
  const dev = (global as any).__DEV__;
  afterEach(() => {
    (global as any).__DEV__ = dev;
  });

  it('is off in dev builds', () => {
    (global as any).__DEV__ = true;
    expect(isErrorIngestEnabled()).toBe(false);
  });

  it('is on in release builds with a backend configured', () => {
    (global as any).__DEV__ = false;
    expect(isErrorIngestEnabled()).toBe(true);
  });
});
