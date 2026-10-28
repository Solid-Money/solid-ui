import { formatNativeAmount, userOperationPrefund } from '@/lib/utils/userOperation';

describe('userOperationPrefund', () => {
  /**
   * The last Oct 14 ETH → USDC swap out of a new Safe on Ethereum, which our
   * policy refused: about 0.00119 ETH (~$2.90) up front, over its $2 cap,
   * though the swap itself would have burnt a fraction of that.
   */
  it('takes every gas limit at the max fee', () => {
    expect(
      userOperationPrefund({
        callGasLimit: 0x92010n,
        verificationGasLimit: 0x6d2e6n,
        preVerificationGas: 0x13a30n,
        paymasterVerificationGasLimit: 0xb578n,
        paymasterPostOpGasLimit: 1n,
        maxFeePerGas: 0x3c4ab59an,
      }),
    ).toBe(1_172_127n * 1_011_529_114n);
  });

  it('counts no paymaster gas on an unsponsored operation', () => {
    expect(
      userOperationPrefund({
        callGasLimit: 100n,
        verificationGasLimit: 200n,
        preVerificationGas: 50n,
        maxFeePerGas: 3n,
      }),
    ).toBe(1050n);
  });
});

describe('formatNativeAmount', () => {
  it.each([
    [1_185_640_585_805_478n, '0.00119'],
    [1_500_000_000_000_000_000n, '1.5'],
    [12_340_000_000_000_000_000n, '12.4'],
    [120_000_000_000_000_000_000n, '120'],
    [0n, '0'],
  ])('shows %s wei as %s, rounded up', (wei, expected) => {
    expect(formatNativeAmount(wei)).toBe(expected);
  });
});
