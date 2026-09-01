import React from 'react';

import { lazyWithRetry } from '@/lib/lazyWithRetry';

/**
 * `lazyWithRetry` wraps `React.lazy`, so the loader it builds is only invoked
 * when React renders the component. These tests reach for that loader directly
 * via the lazy type's internal payload rather than mounting a tree, because
 * mounting pulls in the RN component stack that this Jest config cannot
 * transform. What matters is the retry behavior of the loader itself.
 */
type LazyInternals = { _payload: { _result: () => Promise<unknown> } };

function loaderOf(component: unknown): () => Promise<unknown> {
  return (component as unknown as LazyInternals)._payload._result;
}

describe('lazyWithRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  /** Runs a promise to settlement while draining the retry timers. */
  async function settle<T>(
    p: Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; err: any }> {
    const wrapped = p.then(
      value => ({ ok: true as const, value }),
      err => ({ ok: false as const, err }),
    );
    // Each retry waits on a setTimeout; advance until nothing is pending.
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      jest.runOnlyPendingTimers();
    }
    return wrapped;
  }

  it('resolves without retrying when the import succeeds', async () => {
    const Component = () => null;
    const load = jest.fn().mockResolvedValue({ default: Component });

    const result = await settle(loaderOf(lazyWithRetry(load as any))());

    expect(result).toEqual({ ok: true, value: { default: Component } });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('recovers from a transient failure instead of crashing the boundary', async () => {
    const Component = () => null;
    // One dropped request — the case that took out the whole subtree under
    // LazyThirdwebProvider before this existed.
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('AsyncRequireError'))
      .mockResolvedValue({ default: Component });

    const result = await settle(loaderOf(lazyWithRetry(load as any))());

    expect(result).toEqual({ ok: true, value: { default: Component } });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('retries a bounded number of times, then rethrows', async () => {
    // A chunk removed by a deploy 404s on every attempt; the retry budget has to
    // run out rather than loop, and the original error must reach the boundary.
    const err = new Error('AsyncRequireError');
    const load = jest.fn().mockRejectedValue(err);

    const result = await settle(loaderOf(lazyWithRetry(load as any))());

    expect(result).toEqual({ ok: false, err });
    // Initial attempt plus MAX_RETRIES.
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('produces a usable lazy component', () => {
    const Component = () => null;
    const Lazy = lazyWithRetry(async () => ({ default: Component }));
    expect((Lazy as any).$$typeof).toBe(React.lazy(async () => ({ default: Component })).$$typeof);
  });
});
