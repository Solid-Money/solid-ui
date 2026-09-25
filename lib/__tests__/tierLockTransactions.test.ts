import { type Address, decodeFunctionData, erc20Abi } from 'viem';

import { SolidTierLock_ABI } from '@/lib/abis/SolidTierLock';
import { SolidTierLockZap_ABI, ZAP_NATIVE_ASSET } from '@/lib/abis/SolidTierLockZap';
import { buildLockTransactions } from '@/lib/tierLockTransactions';
import { fuseSharesForAmount, fuseSharesMintedFor } from '@/lib/tierUpgrade';

const LOCK = '0x1111111111111111111111111111111111111111' as Address;
const SHARE = '0x2222222222222222222222222222222222222222' as Address;
const ZAP = '0x3333333333333333333333333333333333333333' as Address;
const WFUSE = '0x4444444444444444444444444444444444444444' as Address;

/** A rate that does not divide evenly, so the two roundings differ by a wei. */
const RATE = 1_200_000_000_000_000_001n;
const AMOUNT = 90_000;

const build = (over: Partial<Parameters<typeof buildLockTransactions>[0]> = {}) =>
  buildLockTransactions({
    asset: 'soFUSE',
    fuseAmount: AMOUNT,
    rate: RATE,
    lockAddress: LOCK,
    shareTokenAddress: SHARE,
    zapAddress: ZAP,
    wrappedNativeAddress: WFUSE,
    ...over,
  });

describe('paying with soFUSE', () => {
  it('approves the lock and locks, in that order, with no value', () => {
    const calls = build();

    expect(calls).toHaveLength(2);
    expect(calls[0].to).toBe(SHARE);
    expect(calls[1].to).toBe(LOCK);
    expect(calls.every(call => call.value === 0n)).toBe(true);
  });

  /** A share too few leaves the position a wei short and buys nothing. */
  it('locks the share count rounded up', () => {
    const calls = build();
    const expected = fuseSharesForAmount(AMOUNT, RATE);

    const approve = decodeFunctionData({ abi: erc20Abi, data: calls[0].data });
    const lock = decodeFunctionData({ abi: SolidTierLock_ABI, data: calls[1].data });

    expect(approve.functionName).toBe('approve');
    expect(approve.args?.[1]).toBe(expected);
    expect(lock.functionName).toBe('lock');
    expect(lock.args?.[0]).toBe(expected);
  });

  /** The only route that does not need the zap — which is why it is preferred. */
  it('needs no zap', () => {
    expect(() => build({ zapAddress: undefined })).not.toThrow();
  });
});

describe('paying with native FUSE', () => {
  it('is one call to the zap, carrying the deposit as value', () => {
    const calls = build({ asset: 'FUSE' });

    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe(ZAP);
    expect(calls[0].value).toBe(90_000n * 10n ** 18n);
  });

  it('names the native sentinel and an amount matching the value', () => {
    const [call] = build({ asset: 'FUSE' });
    const zap = decodeFunctionData({ abi: SolidTierLockZap_ABI, data: call.data });

    expect(zap.functionName).toBe('zapAndLock');
    expect(zap.args?.[0]).toBe(ZAP_NATIVE_ASSET);
    // The zap reverts when these disagree, so they are checked here too.
    expect(zap.args?.[1]).toBe(call.value);
  });

  /**
   * The Teller rounds down, so a floor quoted as a ceiling would be one wei
   * above anything a deposit that does not divide exactly can mint — and every
   * such upgrade would revert.
   */
  it('bounds the mint with the share count rounded down', () => {
    const [call] = build({ asset: 'FUSE' });
    const zap = decodeFunctionData({ abi: SolidTierLockZap_ABI, data: call.data });

    expect(zap.args?.[2]).toBe(fuseSharesMintedFor(AMOUNT, RATE));
    expect(fuseSharesMintedFor(AMOUNT, RATE)).toBeLessThan(fuseSharesForAmount(AMOUNT, RATE));
  });

  /** It is still a bound: a rate that has risen mints fewer than this. */
  it('bounds the mint at the quoted rate, not at zero', () => {
    const [call] = build({ asset: 'FUSE' });
    const zap = decodeFunctionData({ abi: SolidTierLockZap_ABI, data: call.data });

    expect(zap.args?.[2]).toBeGreaterThan(0n);
  });

  it('refuses to build anything when the zap is not deployed', () => {
    expect(() => build({ asset: 'FUSE', zapAddress: undefined })).toThrow(/not available/);
  });
});

describe('paying with WFUSE', () => {
  it('approves the zap and zaps, in that order, with no value', () => {
    const calls = build({ asset: 'WFUSE' });

    expect(calls).toHaveLength(2);
    expect(calls[0].to).toBe(WFUSE);
    expect(calls[1].to).toBe(ZAP);
    expect(calls.every(call => call.value === 0n)).toBe(true);
  });

  it('approves the zap for exactly what it will deposit', () => {
    const calls = build({ asset: 'WFUSE' });
    const approve = decodeFunctionData({ abi: erc20Abi, data: calls[0].data });
    const zap = decodeFunctionData({ abi: SolidTierLockZap_ABI, data: calls[1].data });

    expect(approve.args?.[0]).toBe(ZAP);
    expect(approve.args?.[1]).toBe(zap.args?.[1]);
  });

  it('names WFUSE as the deposit asset, not the native sentinel', () => {
    const calls = build({ asset: 'WFUSE' });
    const zap = decodeFunctionData({ abi: SolidTierLockZap_ABI, data: calls[1].data });

    expect(zap.args?.[0]).toBe(WFUSE);
  });

  it('refuses to build anything without the WFUSE address', () => {
    expect(() => build({ asset: 'WFUSE', wrappedNativeAddress: undefined })).toThrow(
      /not available/,
    );
  });
});

describe('amounts that are not amounts', () => {
  it.each([0, -1, Number.NaN])('refuses %s', amount => {
    expect(() => build({ fuseAmount: amount })).toThrow(/amount to lock/);
    expect(() => build({ asset: 'FUSE', fuseAmount: amount })).toThrow(/amount to lock/);
  });

  /** An unreadable rate is a screen that cannot price the lock yet. */
  it('refuses a rate of zero', () => {
    expect(() => build({ rate: 0n })).toThrow(/amount to lock/);
    expect(() => build({ asset: 'FUSE', rate: 0n })).toThrow(/amount to lock/);
  });
});
