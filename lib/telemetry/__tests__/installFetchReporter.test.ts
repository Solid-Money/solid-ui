/// <reference types="jest" />

import { isErrorIngestEnabled } from '@/lib/telemetry/errorIngestQueue';
import {
  endpointOf,
  installFetchReporter,
  isExpectedFailure,
  isReportableUrl,
  requestMethod,
  requestUrl,
} from '@/lib/telemetry/installFetchReporter';
import { reportError } from '@/lib/telemetry/reportError';

jest.mock('@/lib/config', () => ({
  EXPO_PUBLIC_FLASH_API_BASE_URL: 'https://api.test',
  EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL: 'https://rewards.test/',
  EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL: '',
  EXPO_PUBLIC_FLASH_VAULT_MANAGER_API_BASE_URL: 'https://vaults.test',
}));
jest.mock('@/lib/telemetry/errorIngestQueue', () => ({
  ERROR_INGEST_URL: 'https://api.test/accounts/v1/errors/ingest',
  isErrorIngestEnabled: jest.fn(() => true),
}));
jest.mock('@/lib/telemetry/reportError', () => ({ reportError: jest.fn() }));

const mockReportError = reportError as jest.MockedFunction<typeof reportError>;
const mockEnabled = isErrorIngestEnabled as jest.MockedFunction<typeof isErrorIngestEnabled>;

/** Let the reporter's async read of the cloned body finish. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

const jsonResponse = (status: number, body: unknown, statusText = '') =>
  new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });

describe('installFetchReporter', () => {
  const originalFetch = global.fetch;
  let underlying: jest.Mock;

  beforeEach(() => {
    mockReportError.mockClear();
    mockEnabled.mockReturnValue(true);
    underlying = jest.fn();
    global.fetch = underlying as unknown as typeof fetch;
    installFetchReporter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('wraps fetch once, however often it is installed', () => {
    const wrapped = global.fetch;
    expect(wrapped).not.toBe(underlying);
    installFetchReporter();
    expect(global.fetch).toBe(wrapped);
  });

  it('leaves fetch alone when ingest is off', () => {
    global.fetch = underlying as unknown as typeof fetch;
    mockEnabled.mockReturnValue(false);
    installFetchReporter();
    expect(global.fetch).toBe(underlying);
  });

  it('passes arguments and `this` through, and returns the very same response', async () => {
    const response = jsonResponse(200, { ok: true });
    underlying.mockResolvedValue(response);
    const init = { method: 'POST', body: '{}' };
    const self = {};

    const result = await global.fetch.call(self, 'https://api.test/accounts/v1/users/me', init);

    expect(result).toBe(response);
    expect(underlying).toHaveBeenCalledWith('https://api.test/accounts/v1/users/me', init);
    expect(underlying.mock.contexts[0]).toBe(self);
    await expect(result.json()).resolves.toEqual({ ok: true });
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('returns the original promise untouched for other hosts', () => {
    const pending = Promise.resolve(jsonResponse(500, {}));
    underlying.mockReturnValue(pending);

    expect(global.fetch('https://api.coingecko.com/api/v3/ping')).toBe(pending);
  });

  it('reports a failed response from our backend and still hands over an unread body', async () => {
    const response = jsonResponse(
      400,
      { code: 'INSUFFICIENT_BALANCE', message: ['amount too low', 'try more'] },
      'Bad Request',
    );
    underlying.mockResolvedValue(response);

    const result = await global.fetch('https://api.test/accounts/v1/deposits/123?token=x#frag');
    expect(result).toBe(response);
    // The caller can still read the body after the reporter has read its copy.
    await expect(result.json()).resolves.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    await settle();

    expect(mockReportError).toHaveBeenCalledTimes(1);
    expect(mockReportError).toHaveBeenCalledWith({
      kind: 'api',
      httpStatus: 400,
      endpoint: '/accounts/v1/deposits/123',
      code: 'INSUFFICIENT_BALANCE',
      message: 'amount too low; try more',
    });
  });

  it('falls back to the status text when the body is not JSON', async () => {
    underlying.mockResolvedValue(
      new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
    );

    await global.fetch('https://vaults.test/v1/vaults');
    await settle();

    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'api',
        httpStatus: 502,
        endpoint: '/v1/vaults',
        message: 'Bad Gateway',
      }),
    );
  });

  it('works with Request and URL inputs', async () => {
    underlying.mockImplementation(() => Promise.resolve(jsonResponse(500, { message: 'down' })));

    await global.fetch(new Request('https://rewards.test/rewards/v1/points'));
    await global.fetch(new URL('https://api.test/accounts/v1/cards'));
    await settle();

    expect(mockReportError.mock.calls.map(([input]) => input.endpoint)).toEqual([
      '/rewards/v1/points',
      '/accounts/v1/cards',
    ]);
  });

  it('ignores 401s (the token refresh handles them) and successes', async () => {
    underlying.mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }));
    underlying.mockResolvedValueOnce(jsonResponse(200, {}));

    await global.fetch('https://api.test/accounts/v1/users/me');
    await global.fetch('https://api.test/accounts/v1/users/me');
    await settle();

    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('ignores a 404 on a read ("there is none") but reports one on a write', async () => {
    underlying.mockImplementation(() =>
      Promise.resolve(jsonResponse(404, { message: 'Card not found' })),
    );

    await global.fetch('https://api.test/accounts/v1/cards/status');
    await global.fetch(new Request('https://api.test/accounts/v1/cards/status'));
    await global.fetch('https://api.test/accounts/v1/cards/activate', { method: 'post' });
    await settle();

    expect(mockReportError).toHaveBeenCalledTimes(1);
    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({ httpStatus: 404, endpoint: '/accounts/v1/cards/activate' }),
    );
  });

  it('never reports the ingest endpoint itself', async () => {
    underlying.mockResolvedValue(jsonResponse(500, { message: 'down' }));
    underlying.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(global.fetch('https://api.test/accounts/v1/errors/ingest')).rejects.toThrow();
    await global.fetch('https://api.test/accounts/v1/errors/ingest');
    await settle();

    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('reports a network failure as a warning and rethrows the same error', async () => {
    const failure = new TypeError('Network request failed');
    underlying.mockRejectedValue(failure);

    await expect(global.fetch('https://api.test/accounts/v1/activities')).rejects.toBe(failure);

    expect(mockReportError).toHaveBeenCalledWith({
      kind: 'network',
      severity: 'warning',
      endpoint: '/accounts/v1/activities',
      message: 'Network request failed',
    });
  });

  it('rethrows other failures without reporting them', async () => {
    const aborted = new Error('Aborted');
    aborted.name = 'AbortError';
    underlying.mockRejectedValue(aborted);

    await expect(global.fetch('https://api.test/accounts/v1/activities')).rejects.toBe(aborted);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('does not report when the reporter itself breaks', async () => {
    mockReportError.mockImplementation(() => {
      throw new Error('broken');
    });
    const failure = new TypeError('Failed to fetch');
    underlying.mockRejectedValue(failure);

    await expect(global.fetch('https://api.test/accounts/v1/activities')).rejects.toBe(failure);
    mockReportError.mockReset();
  });
});

describe('url helpers', () => {
  it('reads the URL of every kind of fetch input', () => {
    expect(requestUrl('https://api.test/a')).toBe('https://api.test/a');
    expect(requestUrl(new URL('https://api.test/b'))).toBe('https://api.test/b');
    expect(requestUrl(new Request('https://api.test/c'))).toBe('https://api.test/c');
    expect(requestUrl(undefined)).toBeUndefined();
  });

  it('matches our services on a path boundary only', () => {
    expect(isReportableUrl('https://api.test/accounts/v1/x')).toBe(true);
    expect(isReportableUrl('https://api.test?x=1')).toBe(true);
    expect(isReportableUrl('https://rewards.test/rewards/v1')).toBe(true);
    expect(isReportableUrl('https://api.test.evil.com/accounts')).toBe(false);
    expect(isReportableUrl('https://api.test/accounts/v1/errors/ingest')).toBe(false);
    expect(isReportableUrl('https://example.com/accounts')).toBe(false);
  });

  it('reads the method from init or the Request, defaulting to GET', () => {
    expect(requestMethod('https://api.test', { method: 'delete' })).toBe('DELETE');
    expect(requestMethod(new Request('https://api.test', { method: 'PUT' }), undefined)).toBe(
      'PUT',
    );
    expect(requestMethod('https://api.test', undefined)).toBe('GET');
  });

  it('treats 401s and 404s on reads as answers, not failures', () => {
    expect(isExpectedFailure(401, 'POST')).toBe(true);
    expect(isExpectedFailure(404, 'GET')).toBe(true);
    expect(isExpectedFailure(404, 'POST')).toBe(false);
    expect(isExpectedFailure(403, 'GET')).toBe(false);
    expect(isExpectedFailure(500, 'GET')).toBe(false);
  });

  it('keeps only the path', () => {
    expect(endpointOf('https://api.test/accounts/v1/x?y=1#z')).toBe('/accounts/v1/x');
    expect(endpointOf('https://api.test')).toBe('/');
    expect(endpointOf('/relative/path?q')).toBe('/relative/path');
  });
});
