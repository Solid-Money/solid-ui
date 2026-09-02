import { Currency, CurrencyAmount } from '@cryptoalgebra/fuse-sdk';
import { Address, encodeFunctionData, erc20Abi, isAddress, zeroAddress } from 'viem';

/**
 * Solid's swap fee: how it is sized, and how it is collected.
 *
 * The fee is taken from the source token and sent to the revenue wallet inside
 * the user's own batched transaction, so it costs no extra signature and no
 * extra gas approval. Nothing here talks to the network — it decides the
 * amounts and builds the one call that moves them, so the same numbers can be
 * shown in the confirm sheet, sent on chain, and reported to the backend.
 *
 * Which side of the swap the fee comes out of depends on what the user pinned:
 *
 * - **Exact in** ("swap 100 USDC"): the fee is carved out of the 100, and only
 *   the remainder is swapped. The total debit is exactly what they typed, which
 *   is what makes a max-balance swap work at all — charging on top would need
 *   funds they have already committed.
 * - **Exact out** ("give me 50 USDT"): the input is whatever the route needs, so
 *   the fee is added on top of it. Carving it out of the input would leave the
 *   swap short and deliver less than the amount they pinned.
 */

/** Where a swap fee is taken from, following the side the user pinned. */
export enum SwapFeeBasis {
  /** Carved out of the amount the user typed. */
  DeductedFromInput = 'deducted_from_input',
  /** Added on top of the input the route requires. */
  AddedToInput = 'added_to_input',
}

export interface SwapFee {
  basis: SwapFeeBasis;
  /** Rate applied, as a fraction (0.005 = 0.5%). */
  rate: number;
  /** Fee in the source token's smallest unit. */
  feeAmount: bigint;
  /**
   * What to actually swap, in the source token's smallest unit.
   *
   * Under `DeductedFromInput` this is the typed amount minus the fee; under
   * `AddedToInput` it is the full amount, untouched.
   */
  swapAmount: bigint;
  /** Everything leaving the user's wallet: swap plus fee. */
  totalAmount: bigint;
}

/** No fee is owed — swap the whole amount and add nothing to the batch. */
export const noSwapFee = (amount: bigint): SwapFee => ({
  basis: SwapFeeBasis.DeductedFromInput,
  rate: 0,
  feeAmount: 0n,
  swapAmount: amount,
  totalAmount: amount,
});

/** Rates are stored as fractions; this is the precision the split is done at. */
const RATE_SCALE = 1_000_000n;

/**
 * Size the fee on a swap.
 *
 * Returns a zero fee — and therefore an untouched swap amount — whenever the
 * rate is missing, non-positive or not finite. An Ultra user, a user on a build
 * whose rate request failed, and a program that is switched off all take that
 * path, which is the right default: failing to collect a fee costs us the fee,
 * while inventing one costs the user money.
 */
export function computeSwapFee({
  amount,
  rate,
  basis,
}: {
  amount: bigint;
  rate: number | undefined;
  basis: SwapFeeBasis;
}): SwapFee {
  if (amount <= 0n || !rate || !Number.isFinite(rate) || rate <= 0) {
    return { ...noSwapFee(amount), basis };
  }

  // Rates are clamped server-side, but a client that trusted an out-of-range
  // rate would take the user's whole balance, so it is re-clamped here.
  const safeRate = Math.min(rate, 1);
  const scaledRate = BigInt(Math.round(safeRate * Number(RATE_SCALE)));
  const feeAmount = (amount * scaledRate) / RATE_SCALE;

  // A fee that rounds to nothing (dust amounts on a 6-decimal token) is not
  // worth a transfer: it would cost more gas than it collects.
  if (feeAmount <= 0n) {
    return { ...noSwapFee(amount), basis };
  }

  if (basis === SwapFeeBasis.AddedToInput) {
    return {
      basis,
      rate: safeRate,
      feeAmount,
      swapAmount: amount,
      totalAmount: amount + feeAmount,
    };
  }

  const swapAmount = amount - feeAmount;

  // Nothing left to swap once the fee is out. Only reachable at a 100% rate or
  // on a 1-unit amount; either way, swapping zero would revert, so the fee is
  // dropped rather than the swap.
  if (swapAmount <= 0n) {
    return { ...noSwapFee(amount), basis };
  }

  return {
    basis,
    rate: safeRate,
    feeAmount,
    swapAmount,
    totalAmount: amount,
  };
}

/** One transaction for a batch: the shape `executeTransactions` takes. */
export interface BatchTransaction {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
}

/**
 * The call that moves the fee to the revenue wallet.
 *
 * Returns null whenever the fee cannot be collected safely — no fee owed, no
 * revenue wallet configured, or an address that isn't one. Null means "add
 * nothing to the batch": the swap still goes through, and an uncollected fee is
 * our problem rather than the user's.
 *
 * A native-currency swap (FUSE) sends value with no calldata; an ERC-20 swap
 * sends a `transfer`. The source token is the one being spent, so this is the
 * only token the user is guaranteed to hold at this point in the batch.
 */
export function buildSwapFeeTransfer({
  feeAmount,
  tokenAddress,
  revenueWalletAddress,
  isNative,
}: {
  feeAmount: bigint;
  /** Source token address. Ignored when `isNative`. */
  tokenAddress: string | undefined;
  revenueWalletAddress: string | undefined;
  isNative: boolean;
}): BatchTransaction | null {
  if (feeAmount <= 0n) return null;

  const recipient = revenueWalletAddress?.trim();
  if (!recipient || !isAddress(recipient) || recipient === zeroAddress) {
    return null;
  }

  if (isNative) {
    return { to: recipient as Address, data: '0x', value: feeAmount };
  }

  if (!tokenAddress || !isAddress(tokenAddress)) return null;

  return {
    to: tokenAddress as Address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient as Address, feeAmount],
    }),
  };
}

/**
 * The fee as a currency amount, for display and for the USD figure we report.
 *
 * Built from the source currency so the decimals are the token's own rather
 * than assumed.
 */
export function toFeeCurrencyAmount(
  currency: Currency | undefined,
  feeAmount: bigint,
): CurrencyAmount<Currency> | undefined {
  if (!currency || feeAmount <= 0n) return undefined;
  return CurrencyAmount.fromRawAmount(currency, feeAmount.toString());
}
