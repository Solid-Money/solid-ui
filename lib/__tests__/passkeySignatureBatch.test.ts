/// <reference types="jest" />

import {
  createPasskeySignatureBatch,
  serializeTurnkeySignature,
} from '@/lib/passkeySignatureBatch';

import type { Hex } from 'viem';

const H1 = '0x01' as Hex;
const H2 = '0x02' as Hex;
const sig = (hash: Hex) => `0xsig${hash.slice(2)}` as Hex;

const signer = () => jest.fn(async (hashes: Hex[]) => hashes.map(sig));

describe('createPasskeySignatureBatch', () => {
  afterEach(() => jest.useRealTimers());

  it('signs both hashes with one passkey request', async () => {
    const signAll = signer();
    const batch = createPasskeySignatureBatch({ signAll });
    const fuse = batch.participant();
    const base = batch.participant();

    const [a, b] = await Promise.all([fuse.sign(H1), base.sign(H2)]);

    expect(signAll).toHaveBeenCalledTimes(1);
    expect(signAll).toHaveBeenCalledWith([H1, H2]);
    expect(a).toBe(sig(H1));
    expect(b).toBe(sig(H2));
  });

  it('does not wait for a participant that bows out without signing', async () => {
    // The Base half was already done on-chain, so it has nothing to sign.
    const signAll = signer();
    const batch = createPasskeySignatureBatch({ signAll });
    const fuse = batch.participant();
    const base = batch.participant();

    const signed = fuse.sign(H1);
    base.release();

    await expect(signed).resolves.toBe(sig(H1));
    expect(signAll).toHaveBeenCalledWith([H1]);
  });

  it('fires when the last participant to sign releases first', async () => {
    const signAll = signer();
    const batch = createPasskeySignatureBatch({ signAll });
    const fuse = batch.participant();
    const base = batch.participant();

    base.release();
    await expect(fuse.sign(H1)).resolves.toBe(sig(H1));
    expect(signAll).toHaveBeenCalledTimes(1);
  });

  it('ignores a release from a participant that already signed', async () => {
    const signAll = signer();
    const batch = createPasskeySignatureBatch({ signAll });
    const fuse = batch.participant();
    const base = batch.participant();

    const first = fuse.sign(H1);
    fuse.release();
    // Still waiting on Base: a release after signing must not trigger the batch early.
    expect(signAll).not.toHaveBeenCalled();

    const second = base.sign(H2);
    await expect(Promise.all([first, second])).resolves.toEqual([sig(H1), sig(H2)]);
    expect(signAll).toHaveBeenCalledTimes(1);
  });

  it('signs what has arrived once the wait runs out, and the latecomer on its own', async () => {
    jest.useFakeTimers();
    const signAll = signer();
    const batch = createPasskeySignatureBatch({ signAll, flushAfterMs: 1_000 });
    const fuse = batch.participant();
    const base = batch.participant();

    const first = fuse.sign(H1);
    jest.advanceTimersByTime(1_000);
    await expect(first).resolves.toBe(sig(H1));
    expect(signAll).toHaveBeenLastCalledWith([H1]);

    await expect(base.sign(H2)).resolves.toBe(sig(H2));
    expect(signAll).toHaveBeenLastCalledWith([H2]);
    expect(signAll).toHaveBeenCalledTimes(2);
  });

  it('rejects every waiting signer when the passkey prompt is dismissed', async () => {
    const dismissed = new Error('The operation either timed out or was not allowed');
    const batch = createPasskeySignatureBatch({ signAll: jest.fn().mockRejectedValue(dismissed) });
    const fuse = batch.participant();
    const base = batch.participant();

    const results = await Promise.allSettled([fuse.sign(H1), base.sign(H2)]);

    expect(results).toEqual([
      { status: 'rejected', reason: dismissed },
      { status: 'rejected', reason: dismissed },
    ]);
  });

  it('serialises a Turnkey signature as the Safe owner signature @turnkey/viem produces', () => {
    const r = 'ab'.repeat(32);
    const s = '0c'.repeat(32);
    expect(serializeTurnkeySignature({ r, s, v: '00' })).toBe(`0x${r}${s}1b`);
    expect(serializeTurnkeySignature({ r, s, v: '01' })).toBe(`0x${r}${s}1c`);
    expect(() => serializeTurnkeySignature({ r, s, v: '1b' })).toThrow();
  });

  it('refuses to hand out signatures that do not line up with the hashes', async () => {
    const batch = createPasskeySignatureBatch({
      signAll: jest.fn().mockResolvedValue([sig(H1)]),
    });
    const fuse = batch.participant();
    const base = batch.participant();

    const results = await Promise.allSettled([fuse.sign(H1), base.sign(H2)]);

    expect(results.every(result => result.status === 'rejected')).toBe(true);
  });
});
