/// <reference types="jest" />

import { throwIfNotOk } from '@/lib/api';

/**
 * Regression guard for SOLID-W3: ensureWebhookSubscription (and all other
 * fetch calls in lib/api.ts) previously threw the raw Response object when the
 * server returned a non-2xx status. TanStack Mutation's onError passed it
 * directly to Sentry.captureException, which serialised the Response keys
 * (_bodyBlob, _bodyInit, ok, status…) as the exception title rather than a
 * human-readable message.
 *
 * throwIfNotOk ensures every failed fetch produces a proper Error instance.
 */
describe('throwIfNotOk', () => {
  const makeResponse = (status: number, statusText: string, ok: boolean): Response =>
    ({
      ok,
      status,
      statusText,
      url: 'https://api.example.com/test',
    }) as unknown as Response;

  it('does nothing when the response is OK', () => {
    const response = makeResponse(200, 'OK', true);
    expect(() => throwIfNotOk(response)).not.toThrow();
  });

  it('throws an Error instance (not the Response object) on a non-OK response', () => {
    const response = makeResponse(401, 'Unauthorized', false);
    expect(() => throwIfNotOk(response)).toThrow(Error);
  });

  it('includes the HTTP status code in the error message', () => {
    const response = makeResponse(401, 'Unauthorized', false);
    expect(() => throwIfNotOk(response)).toThrow('401');
  });

  it('includes the status text in the error message', () => {
    const response = makeResponse(503, 'Service Unavailable', false);
    expect(() => throwIfNotOk(response)).toThrow('Service Unavailable');
  });

  it('includes the URL in the error message', () => {
    const response = makeResponse(500, 'Internal Server Error', false);
    expect(() => throwIfNotOk(response)).toThrow('https://api.example.com/test');
  });

  it('throws for 4xx responses', () => {
    const response = makeResponse(403, 'Forbidden', false);
    expect(() => throwIfNotOk(response)).toThrow(Error);
  });

  it('throws for 5xx responses', () => {
    const response = makeResponse(500, 'Internal Server Error', false);
    expect(() => throwIfNotOk(response)).toThrow(Error);
  });
});
