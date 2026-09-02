import { zeroAddress } from 'viem';

import { buildSwapFeeTransfer, computeSwapFee, noSwapFee, SwapFeeBasis } from '@/lib/utils/swapFee';

/** A 6-decimal token amount, the common case (USDC/USDT on Fuse). */
const usdc = (whole: number) => BigInt(Math.round(whole * 1_000_000));

const REVENUE_WALLET = '0x1111111111111111111111111111111111111111';
const TOKEN = '0x2222222222222222222222222222222222222222';

/** Core pays 0.5%, Prime 0.25%, Ultra nothing. */
const CORE_RATE = 0.005;
const PRIME_RATE = 0.0025;
const ULTRA_RATE = 0;

describe('computeSwapFee — exact in (fee carved out of the typed amount)', () => {
  const basis = SwapFeeBasis.DeductedFromInput;

  it('takes the Core rate out of the amount and swaps the rest', () => {
    const fee = computeSwapFee({ amount: usdc(100), rate: CORE_RATE, basis });

    expect(fee.feeAmount).toBe(usdc(0.5));
    expect(fee.swapAmount).toBe(usdc(99.5));
    // The whole point of carving it out: the debit is exactly what was typed,
    // so a max-balance swap still fits.
    expect(fee.totalAmount).toBe(usdc(100));
  });

  it('halves the fee on Prime', () => {
    const fee = computeSwapFee({ amount: usdc(100), rate: PRIME_RATE, basis });

    expect(fee.feeAmount).toBe(usdc(0.25));
    expect(fee.swapAmount).toBe(usdc(99.75));
  });

  it('charges an Ultra user nothing and swaps the full amount', () => {
    const fee = computeSwapFee({ amount: usdc(100), rate: ULTRA_RATE, basis });

    expect(fee.feeAmount).toBe(0n);
    expect(fee.swapAmount).toBe(usdc(100));
    expect(fee.totalAmount).toBe(usdc(100));
  });

  it.each([
    ['undefined', undefined],
    ['zero', 0],
    ['negative', -0.005],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('collects nothing on a %s rate rather than inventing a fee', (_label, rate) => {
    const fee = computeSwapFee({ amount: usdc(100), rate, basis });

    expect(fee.feeAmount).toBe(0n);
    expect(fee.swapAmount).toBe(usdc(100));
  });

  it('clamps a rate above 1 instead of taking more than the swap', () => {
    // A server that shipped `50` instead of `0.5` would otherwise take 50x.
    const fee = computeSwapFee({ amount: usdc(100), rate: 50, basis });

    expect(fee.feeAmount).toBeLessThanOrEqual(usdc(100));
    expect(fee.swapAmount).toBe(usdc(100));
    // Nothing left to swap at 100%, so the fee is dropped, not the swap.
    expect(fee.feeAmount).toBe(0n);
  });

  it('drops a fee that rounds away to nothing', () => {
    // 0.5% of 1 unit of a 6-decimal token rounds to zero; a transfer of nothing
    // would cost more gas than it collects.
    const fee = computeSwapFee({ amount: 1n, rate: CORE_RATE, basis });

    expect(fee.feeAmount).toBe(0n);
    expect(fee.swapAmount).toBe(1n);
  });

  it('handles a zero amount without dividing by anything', () => {
    const fee = computeSwapFee({ amount: 0n, rate: CORE_RATE, basis });

    expect(fee.feeAmount).toBe(0n);
    expect(fee.swapAmount).toBe(0n);
  });

  it('never lets the fee and the swap exceed what the user typed', () => {
    for (const amount of [usdc(1), usdc(37.42), usdc(1000), usdc(999999.99)]) {
      const fee = computeSwapFee({ amount, rate: CORE_RATE, basis });
      expect(fee.feeAmount + fee.swapAmount).toBe(amount);
      expect(fee.totalAmount).toBe(amount);
    }
  });
});

describe('computeSwapFee — exact out (fee added on top of the required input)', () => {
  const basis = SwapFeeBasis.AddedToInput;

  it('leaves the swap amount alone and bills the fee on top', () => {
    const fee = computeSwapFee({ amount: usdc(100), rate: CORE_RATE, basis });

    // The route needs all 100 to deliver the output the user pinned; carving
    // the fee out would deliver less than they asked for.
    expect(fee.swapAmount).toBe(usdc(100));
    expect(fee.feeAmount).toBe(usdc(0.5));
    expect(fee.totalAmount).toBe(usdc(100.5));
  });

  it('charges an Ultra user nothing extra', () => {
    const fee = computeSwapFee({ amount: usdc(100), rate: ULTRA_RATE, basis });

    expect(fee.feeAmount).toBe(0n);
    expect(fee.totalAmount).toBe(usdc(100));
  });
});

describe('noSwapFee', () => {
  it('swaps the whole amount and collects nothing', () => {
    const fee = noSwapFee(usdc(42));

    expect(fee.feeAmount).toBe(0n);
    expect(fee.swapAmount).toBe(usdc(42));
    expect(fee.totalAmount).toBe(usdc(42));
    expect(fee.rate).toBe(0);
  });
});

describe('buildSwapFeeTransfer', () => {
  it('builds an ERC-20 transfer to the revenue wallet', () => {
    const tx = buildSwapFeeTransfer({
      feeAmount: usdc(0.5),
      tokenAddress: TOKEN,
      revenueWalletAddress: REVENUE_WALLET,
      isNative: false,
    });

    expect(tx).not.toBeNull();
    // Sent to the token contract, not the wallet: it is a `transfer` call.
    expect(tx?.to).toBe(TOKEN);
    expect(tx?.data.startsWith('0xa9059cbb')).toBe(true);
    expect(tx?.data.toLowerCase()).toContain(REVENUE_WALLET.slice(2).toLowerCase());
    expect(tx?.value).toBeUndefined();
  });

  it('sends value with no calldata for a native-currency swap', () => {
    const tx = buildSwapFeeTransfer({
      feeAmount: 1_000n,
      tokenAddress: undefined,
      revenueWalletAddress: REVENUE_WALLET,
      isNative: true,
    });

    expect(tx).toEqual({ to: REVENUE_WALLET, data: '0x', value: 1_000n });
  });

  it('collects nothing when no fee is owed', () => {
    expect(
      buildSwapFeeTransfer({
        feeAmount: 0n,
        tokenAddress: TOKEN,
        revenueWalletAddress: REVENUE_WALLET,
        isNative: false,
      }),
    ).toBeNull();
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['the zero address', zeroAddress],
    ['not an address', 'revenue-wallet'],
  ])('refuses to send the fee when the revenue wallet is %s', (_label, wallet) => {
    // Burning the user's money is strictly worse than not collecting the fee.
    expect(
      buildSwapFeeTransfer({
        feeAmount: usdc(0.5),
        tokenAddress: TOKEN,
        revenueWalletAddress: wallet,
        isNative: false,
      }),
    ).toBeNull();
  });

  it('refuses an ERC-20 transfer with no usable token address', () => {
    expect(
      buildSwapFeeTransfer({
        feeAmount: usdc(0.5),
        tokenAddress: 'not-a-token',
        revenueWalletAddress: REVENUE_WALLET,
        isNative: false,
      }),
    ).toBeNull();
  });
});
