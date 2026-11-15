/// <reference types="jest" />

import { FetchTimeoutError, fetchWithTimeout } from '@/lib/fetchWithTimeout';

/**
 * The bug this covers: the deposit-address request had no timeout, so a backend
 * stuck behind a slow webhook provider left the deposit screen spinning with no
 * address, no error and nothing to retry.
 */
describe('fetchWithTimeout', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  /** A fetch that never answers on its own and only settles once aborted. */
  const hangingFetch = () =>
    jest.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );

  it('passes the response through when the request answers in time', async () => {
    const response = { ok: true } as Response;
    global.fetch = jest.fn(() => Promise.resolve(response)) as unknown as typeof fetch;

    await expect(fetchWithTimeout('https://example.test', {}, 1000)).resolves.toBe(response);
  });

  it('rejects with FetchTimeoutError once the deadline passes', async () => {
    jest.useFakeTimers();
    global.fetch = hangingFetch() as unknown as typeof fetch;

    const pending = fetchWithTimeout('https://example.test', {}, 30000);
    // Attach the assertion before advancing so the rejection is never unhandled.
    const assertion = expect(pending).rejects.toBeInstanceOf(FetchTimeoutError);

    await jest.advanceTimersByTimeAsync(30000);

    await assertion;
  });

  it('leaves a caller-supplied abort reported as an AbortError', async () => {
    // A superseded request must stay distinguishable from a timeout - callers
    // deliberately ignore AbortError.
    global.fetch = hangingFetch() as unknown as typeof fetch;
    const controller = new AbortController();
    const pending = fetchWithTimeout('https://example.test', { signal: controller.signal }, 30000);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('times out while reading a body after the headers arrive', async () => {
    jest.useFakeTimers();
    const json = jest.fn(() => new Promise(() => {}));
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json });
    const pending = fetchWithTimeout('https://example.test', {}, 5000, response => response.json());
    const assertion = expect(pending).rejects.toBeInstanceOf(FetchTimeoutError);

    await jest.advanceTimersByTimeAsync(4999);
    expect(json).toHaveBeenCalledTimes(1);
    const init = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(init.signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);

    await assertion;
    expect(init.signal.aborted).toBe(true);
  });

  it('does not leave its timer running after the request settles', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true } as Response),
    ) as unknown as typeof fetch;

    await fetchWithTimeout('https://example.test', {}, 30000);

    expect(jest.getTimerCount()).toBe(0);
  });
});
