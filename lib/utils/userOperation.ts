import { formatUnits } from 'viem';

export interface UserOperationGas {
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  paymasterVerificationGasLimit?: bigint;
  paymasterPostOpGasLimit?: bigint;
  maxFeePerGas: bigint;
}

/**
 * What the EntryPoint (v0.7) takes from an unsponsored account before running
 * its operation: every gas limit at the max fee. The unused part is refunded
 * in the same transaction, but the account has to hold all of it, on top of
 * whatever its calls send, when the operation is validated.
 */
export const userOperationPrefund = (op: UserOperationGas): bigint =>
  (op.callGasLimit +
    op.verificationGasLimit +
    op.preVerificationGas +
    (op.paymasterVerificationGasLimit ?? 0n) +
    (op.paymasterPostOpGasLimit ?? 0n)) *
  op.maxFeePerGas;

/**
 * A native amount for a sentence: three significant digits, rounded up so a
 * maximum is never shown below what it is. `1185640585805478n` → `0.00119`.
 */
export const formatNativeAmount = (wei: bigint, decimals = 18): string => {
  const value = Number(formatUnits(wei, decimals));
  if (value === 0) return '0';
  const magnitude = Math.floor(Math.log10(value));
  const step = 10 ** (magnitude - 2);
  const rounded = Math.ceil(value / step) * step;
  // toFixed keeps small values out of exponent notation; trailing zeros dropped.
  const places = Math.max(0, 2 - magnitude);
  const fixed = rounded.toFixed(places);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
};
