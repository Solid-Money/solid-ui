import { formatUnits } from 'viem';

import { CrossChainSendApiError } from '@/lib/api/cross-chain-send';
import { SwapErrorCode, swapErrorCopy } from '@/lib/swapErrors';
import { CrossChainSendQuote } from '@/lib/types/cross-chain-send';

/**
 * The swap form's side of a move over Solid's bridge (`solidBridgeRoute`):
 * the cross-chain send quoted and signed from the user's own Safe to itself on
 * the other network.
 */

/** Human units of a quote amount, which is in the decimals of the coin sent. */
export const bridgeAmount = (
  raw: string,
  quote: Pick<CrossChainSendQuote, 'decimals'>,
  sentDecimals: number,
): number => Number(formatUnits(BigInt(raw), quote.decimals ?? sentDecimals));

/**
 * What "You get" reads for a bridge quote. When the bridge lands the coin
 * asked for, the amount it delivers. When a swap on Fuse follows, an estimate
 * at today's prices: that swap is priced when the user signs it, after the
 * coin arrives. Undefined when either price is missing.
 */
export function bridgeToAmount(
  received: number,
  { thenSwap, landsAsPrice, toPrice }: { thenSwap: boolean; landsAsPrice: number; toPrice: number },
): number | undefined {
  if (!thenSwap) return received;
  if (!(landsAsPrice > 0) || !(toPrice > 0)) return undefined;
  return (received * landsAsPrice) / toPrice;
}

const sentence = (message: string) => (/[.!?]$/.test(message) ? message : `${message}.`);

/**
 * A refused bridge quote as the form shows it. The backend's 400s are written
 * for users ("Minimum is 5 USDC from Base"), so they're shown as they are; a
 * 503 says the route or the fee can't be priced right now.
 */
export function bridgeQuoteError(error: unknown): { code: SwapErrorCode; copy: string } {
  if (error instanceof CrossChainSendApiError) {
    const copy = sentence(error.message);
    if (error.status === 400) {
      if (/^Minimum|too small/i.test(error.message)) return { code: 'AMOUNT_TOO_LOW', copy };
      if (/^Maximum|^Up to|limit|sends today/i.test(error.message)) {
        return { code: 'AMOUNT_TOO_HIGH', copy };
      }
      return { code: 'QUOTE_UNAVAILABLE', copy };
    }
    if (error.status === 503) {
      return /paused/i.test(error.message)
        ? {
            code: 'QUOTE_UNAVAILABLE',
            copy: 'Moving coins between networks is paused right now. Try again later.',
          }
        : { code: 'QUOTE_UNAVAILABLE', copy };
    }
  }
  return { code: 'QUOTE_UNAVAILABLE', copy: swapErrorCopy('QUOTE_UNAVAILABLE') };
}
