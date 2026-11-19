import { type Address, decodeFunctionData, erc20Abi } from 'viem';

import { Safe_ABI } from '@/lib/abis/Safe';
import { SolidSubscriptionModule_ABI } from '@/lib/abis/SolidSubscriptionModule';
import { UserCopyError } from '@/lib/errors/UserCopyError';
import {
  buildSubscriptionTransactions,
  SUBSCRIPTION_PERIOD_SECONDS,
  usdToBillingUnits,
} from '@/lib/tierSubscriptionTransactions';

const SAFE = '0x1111111111111111111111111111111111111111' as Address;
const MODULE = '0x2222222222222222222222222222222222222222' as Address;
const USDC = '0x3333333333333333333333333333333333333333' as Address;
const TREASURY = '0x4444444444444444444444444444444444444444' as Address;

const build = (over: Partial<Parameters<typeof buildSubscriptionTransactions>[0]> = {}) =>
  buildSubscriptionTransactions({
    mode: 'module',
    safeAddress: SAFE,
    moduleAddress: MODULE,
    moduleEnabled: false,
    mandateUsd: 999,
    chargeUsd: 799,
    billingTokenAddress: USDC,
    revenueTreasuryAddress: TREASURY,
    ...over,
  });

const decodeSubscribe = (data: `0x${string}`) =>
  decodeFunctionData({ abi: SolidSubscriptionModule_ABI, data });

describe('usdToBillingUnits', () => {
  it('scales dollars to six-decimal USDC', () => {
    expect(usdToBillingUnits(999)).toBe(999_000_000n);
    expect(usdToBillingUnits(159)).toBe(159_000_000n);
  });

  /** A price stored as a decimal must not become an amount a fraction off it. */
  it('rounds to whole cents first', () => {
    expect(usdToBillingUnits(199.999)).toBe(200_000_000n);
    expect(usdToBillingUnits(0.1 + 0.2)).toBe(300_000n);
  });

  it('is zero for anything that is not a positive amount', () => {
    expect(usdToBillingUnits(0)).toBe(0n);
    expect(usdToBillingUnits(-5)).toBe(0n);
    expect(usdToBillingUnits(Number.NaN)).toBe(0n);
  });
});

describe('a first membership, charged through the module', () => {
  it('enables the module, then signs the mandate, on the Safe and the module', () => {
    const calls = build();

    expect(calls.map(call => call.to)).toEqual([SAFE, MODULE]);
    expect(calls.every(call => call.value === 0n)).toBe(true);
    expect(decodeFunctionData({ abi: Safe_ABI, data: calls[0].data })).toMatchObject({
      functionName: 'enableModule',
      args: [MODULE],
    });
  });

  /**
   * The bug this replaced: the mandate was signed at the price paid now, so a
   * $799 sale signed a $799 cap and the $999 renewal would have been refused.
   */
  it('signs the mandate at the annual fee, not the first-year price', () => {
    const subscribe = decodeSubscribe(build().at(-1)!.data);

    expect(subscribe.functionName).toBe('subscribe');
    expect(subscribe.args).toEqual([999_000_000n, SUBSCRIPTION_PERIOD_SECONDS]);
  });

  it('skips enabling a module that is already enabled, which would revert', () => {
    const calls = build({ moduleEnabled: true });

    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe(MODULE);
  });

  /** The backend takes the first year; nothing in this batch moves USDC. */
  it('moves no USDC itself', () => {
    expect(build().some(call => call.to === USDC)).toBe(false);
  });

  it('refuses a tier with no price', () => {
    expect(() => build({ mandateUsd: 0 })).toThrow(UserCopyError);
  });
});

describe('an upgrade, paid by transfer', () => {
  const transfer = (over: Partial<Parameters<typeof buildSubscriptionTransactions>[0]> = {}) =>
    build({ mode: 'transfer', moduleEnabled: true, ...over });

  /** Payment first, mandate after, in one user operation — neither lands alone. */
  it('pays the treasury, then raises the mandate, in one batch', () => {
    const calls = transfer();

    expect(calls.map(call => call.to)).toEqual([USDC, MODULE]);
    expect(calls.every(call => call.value === 0n)).toBe(true);
  });

  it('pays the first-year price to the treasury in USDC units', () => {
    const [payment] = transfer();

    expect(decodeFunctionData({ abi: erc20Abi, data: payment.data })).toMatchObject({
      functionName: 'transfer',
      args: [TREASURY, 799_000_000n],
    });
  });

  it('signs the mandate at the annual fee, whatever the first year cost', () => {
    expect(decodeSubscribe(transfer().at(-1)!.data).args).toEqual([
      999_000_000n,
      SUBSCRIPTION_PERIOD_SECONDS,
    ]);
  });

  it('rounds the payment to cents, as it does the mandate', () => {
    const [payment] = transfer({ chargeUsd: 158.999 });

    expect(decodeFunctionData({ abi: erc20Abi, data: payment.data }).args?.[1]).toBe(159_000_000n);
  });

  /** An upgrader has normally enabled it already, but a lapsed one may not have. */
  it('enables the module between the payment and the mandate when it is off', () => {
    const calls = transfer({ moduleEnabled: false });

    expect(calls.map(call => call.to)).toEqual([USDC, SAFE, MODULE]);
    expect(decodeFunctionData({ abi: Safe_ABI, data: calls[1].data }).functionName).toBe(
      'enableModule',
    );
  });

  it('refuses to build without the treasury, the USDC, or a payment', () => {
    expect(() => transfer({ revenueTreasuryAddress: null })).toThrow(UserCopyError);
    expect(() => transfer({ billingTokenAddress: undefined })).toThrow(UserCopyError);
    expect(() => transfer({ chargeUsd: 0 })).toThrow(UserCopyError);
    expect(() => transfer({ chargeUsd: undefined })).toThrow(UserCopyError);
  });
});
