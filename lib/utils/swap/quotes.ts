import { TradeType } from '@cryptoalgebra/fuse-sdk';

/**
 * One route's answer from Algebra's QuoterV2, in the order it returns them:
 * amountOutList, amountInList, sqrtPriceX96AfterList,
 * initializedTicksCrossedList, gasEstimate, feeList. Each list has one entry
 * per hop.
 */
export type QuoterResult = readonly [
  readonly bigint[],
  readonly bigint[],
  readonly bigint[],
  readonly number[],
  bigint,
  readonly number[],
];

export interface BestQuote {
  /** Which of the quoted routes this is. */
  index: number;
  /** The side the quote settles: the output on exact-in, the input on exact-out. */
  amount: bigint;
  fee: readonly number[];
  priceAfterSwap: readonly bigint[];
}

/**
 * What a route's quote settles on: the last hop's output for an exact-in swap,
 * the total input for an exact-out one.
 */
export function quotedAmount(result: QuoterResult, tradeType: TradeType): bigint | undefined {
  const amounts = tradeType === TradeType.EXACT_INPUT ? result[0] : result[1];
  return amounts[amounts.length - 1];
}

/**
 * The route quote that's best for the user: the most output for an exact-in
 * swap, the least input for an exact-out one. Routes the quoter couldn't price
 * are skipped, and on a tie the earlier route wins.
 */
export function selectBestQuote(
  results: readonly { result?: unknown }[] | undefined,
  tradeType: TradeType,
): BestQuote | undefined {
  let best: BestQuote | undefined;

  for (const [index, { result }] of (results ?? []).entries()) {
    if (!result) continue;

    const quote = result as QuoterResult;
    const amount = quotedAmount(quote, tradeType);
    if (amount === undefined) continue;

    const isBetter =
      !best || (tradeType === TradeType.EXACT_INPUT ? amount > best.amount : amount < best.amount);
    if (isBetter) best = { index, amount, fee: quote[5], priceAfterSwap: quote[2] };
  }

  return best;
}
