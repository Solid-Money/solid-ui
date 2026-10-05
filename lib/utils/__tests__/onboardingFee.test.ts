import { decodeFunctionData, erc20Abi, getAddress } from 'viem';

import {
  assetBalanceUsd,
  buildFeeTransfer,
  FeePaymentAsset,
  selectFeePayment,
  sizeFeeAmount,
} from '@/lib/utils/onboardingFee';

const TREASURY = getAddress('0x845703b9ffAdfbEBaDc6a9E23E1DDe39Fdec6A6b');
const SOUSD = getAddress('0x740636B7e6E6F6a4FD80A8781CfD3AA993821C1D');
const USDC = getAddress('0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9');

const soUsd = (balance: bigint, usdPerToken = 1.0432): FeePaymentAsset => ({
  tokenAddress: SOUSD,
  symbol: 'soUSD',
  decimals: 6,
  balance,
  usdPerToken,
});

const usdc = (balance: bigint): FeePaymentAsset => ({
  tokenAddress: USDC,
  symbol: 'USDC',
  decimals: 6,
  balance,
  usdPerToken: 1,
});

describe('sizeFeeAmount', () => {
  it('sizes a dollar-pegged token exactly', () => {
    expect(sizeFeeAmount(10, usdc(0n))).toBe(10_000_000n);
  });

  it('divides by the share rate for a vault token', () => {
    // $10 of soUSD at 1.0432 is 9.585889... shares.
    expect(sizeFeeAmount(10, soUsd(0n))).toBe(9_585_890n);
  });

  /**
   * The server re-values the transfer with its own price. Rounding down puts
   * the payment fractionally under the fee before the rate has even moved,
   * spending the tolerance that exists to absorb real drift.
   */
  it('rounds up, never down', () => {
    const amount = sizeFeeAmount(10, soUsd(0n));
    const valued = (Number(amount) / 1e6) * 1.0432;
    expect(valued).toBeGreaterThanOrEqual(10);
  });

  it('sizes nothing when the fee or the rate is unusable', () => {
    expect(sizeFeeAmount(0, usdc(0n))).toBe(0n);
    expect(sizeFeeAmount(-1, usdc(0n))).toBe(0n);
    expect(sizeFeeAmount(Number.NaN, usdc(0n))).toBe(0n);
    expect(sizeFeeAmount(10, { ...usdc(0n), usdPerToken: 0 })).toBe(0n);
    expect(sizeFeeAmount(10, { ...usdc(0n), usdPerToken: Number.NaN })).toBe(0n);
  });
});

describe('assetBalanceUsd', () => {
  it('values a holding at its rate', () => {
    expect(assetBalanceUsd(soUsd(100_000_000n))).toBeCloseTo(104.32, 2);
    expect(assetBalanceUsd(usdc(1_284_500_000n))).toBeCloseTo(1284.5, 2);
  });

  it('values an unpriceable holding at nothing rather than NaN', () => {
    expect(assetBalanceUsd({ ...usdc(1n), usdPerToken: Number.NaN })).toBe(0);
  });
});

describe('selectFeePayment', () => {
  it('takes the first asset that covers the fee, not the largest', () => {
    // soUSD covers it, so USDC is left alone even though there is more of it.
    const payment = selectFeePayment(10, [soUsd(20_000_000n), usdc(500_000_000n)]);

    expect(payment?.asset.symbol).toBe('soUSD');
    expect(payment?.amount).toBe(9_585_890n);
  });

  it('falls through to the next asset when the first is short', () => {
    const payment = selectFeePayment(10, [soUsd(1_000_000n), usdc(50_000_000n)]);

    expect(payment?.asset.symbol).toBe('USDC');
    expect(payment?.amount).toBe(10_000_000n);
  });

  /** A transfer the user cannot cover reverts and costs them a signature. */
  it('selects nothing when no asset covers the fee', () => {
    expect(selectFeePayment(10, [soUsd(1_000_000n), usdc(2_000_000n)])).toBeUndefined();
  });

  it('accepts a balance exactly equal to the sized amount', () => {
    expect(selectFeePayment(10, [usdc(10_000_000n)])?.amount).toBe(10_000_000n);
  });

  it('selects nothing when nothing is owed', () => {
    expect(selectFeePayment(0, [usdc(10_000_000n)])).toBeUndefined();
  });

  it('reports what the payment is worth, in USD', () => {
    const payment = selectFeePayment(10, [usdc(50_000_000n)]);
    expect(payment?.amountUsd).toBeCloseTo(10, 6);
  });
});

describe('buildFeeTransfer', () => {
  it('builds an ERC-20 transfer to the treasury', () => {
    const call = buildFeeTransfer({
      treasuryAddress: TREASURY,
      tokenAddress: USDC,
      amount: 10_000_000n,
    });

    expect(call).toMatchObject({ to: USDC, value: 0n });
    expect(decodeFunctionData({ abi: erc20Abi, data: call!.data })).toMatchObject({
      functionName: 'transfer',
      args: [TREASURY, 10_000_000n],
    });
  });

  /**
   * The server credits only a transfer that reached the treasury, so a
   * transfer built without one takes the money and pays nothing.
   */
  it('builds nothing without a usable treasury address', () => {
    const base = { tokenAddress: USDC, amount: 10_000_000n };

    expect(buildFeeTransfer({ ...base, treasuryAddress: undefined })).toBeNull();
    expect(buildFeeTransfer({ ...base, treasuryAddress: '' })).toBeNull();
    expect(buildFeeTransfer({ ...base, treasuryAddress: 'not-an-address' })).toBeNull();
  });

  it('builds nothing for a zero or negative amount', () => {
    expect(
      buildFeeTransfer({ treasuryAddress: TREASURY, tokenAddress: USDC, amount: 0n }),
    ).toBeNull();
  });
});
