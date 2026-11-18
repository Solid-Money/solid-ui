import { LifiSwapApiError } from '@/lib/api/lifi-swap';

/**
 * Why a swap can't go ahead, as a code. The backend sends these with every
 * refused quote (solid-backend lifi-swap/lifi-swap.errors.ts); the app adds its
 * own for what only it can see. The copy shown for each is below, never the
 * backend's message, which is there for older builds.
 */
export const SWAP_ERROR_CODES = [
  // From the backend.
  'SAME_TOKEN',
  'TOKEN_NOT_SWAPPABLE',
  'NO_ROUTE',
  'AMOUNT_TOO_LOW',
  'AMOUNT_TOO_HIGH',
  'QUOTES_BUSY',
  'QUOTE_UNAVAILABLE',
  'NO_WALLET',
  'UPGRADE_UNAVAILABLE',
  'UPGRADE_WRONG_TOKEN',
  'UPGRADE_FROM_FUSE',
  'UPGRADE_ALREADY_MEMBER',
  'UPGRADE_UNPRICED',
  'UPGRADE_TOO_MUCH',
  // From the app.
  'NOT_ENOUGH_BALANCE',
  'NOT_ENOUGH_GAS_MONEY',
  'PRICE_CHANGED',
  'PRICE_IMPACT_TOO_HIGH',
  'SWAP_FAILED',
] as const;

export type SwapErrorCode = (typeof SWAP_ERROR_CODES)[number];

const isSwapErrorCode = (value: unknown): value is SwapErrorCode =>
  typeof value === 'string' && (SWAP_ERROR_CODES as readonly string[]).includes(value);

/**
 * The code behind a failed quote. A backend that predates codes is read by
 * status: 422 was "no route", 503 "busy", anything else unavailable.
 */
export function swapErrorCodeOf(error: unknown): SwapErrorCode {
  if (error instanceof LifiSwapApiError) {
    if (isSwapErrorCode(error.code)) return error.code;
    if (error.status === 422) return 'NO_ROUTE';
    if (error.status === 429 || error.status === 503) return 'QUOTES_BUSY';
  }
  return 'QUOTE_UNAVAILABLE';
}

export interface SwapErrorContext {
  /** "You pay" coin, as the screen names it. */
  from?: string;
  /** "You get" coin, as the screen names it. */
  to?: string;
  /** The pair's minimum, formatted, in the "You pay" coin. */
  minAmount?: string;
  /** For NOT_ENOUGH_GAS_MONEY: what the route needs on top, formatted with its coin. */
  gasMoney?: string;
  network?: string;
}

/**
 * The Errors table: every reason a swap stops, in the words the screen uses.
 * Short enough for the line under the amount; the button says it in two or
 * three words (`swapErrorButtonLabel`).
 */
export function swapErrorCopy(code: SwapErrorCode, ctx: SwapErrorContext = {}): string {
  const from = ctx.from ?? 'this coin';
  const to = ctx.to ?? 'that coin';
  switch (code) {
    case 'SAME_TOKEN':
      return 'Pick a different coin to get.';
    case 'TOKEN_NOT_SWAPPABLE':
      return `${from} can’t be swapped yet. Pick another coin.`;
    case 'NO_ROUTE':
      return ctx.from === 'USDC' || ctx.to === 'USDC'
        ? `We can’t swap ${from} to ${to} right now. Try another coin.`
        : `We can’t swap ${from} to ${to} right now. Swap it to USDC first, or try another coin.`;
    case 'AMOUNT_TOO_LOW':
      return ctx.minAmount
        ? `The smallest amount for this swap is ${ctx.minAmount} ${from}.`
        : 'That amount is too small to swap. Try a larger amount.';
    case 'AMOUNT_TOO_HIGH':
      return 'That’s more than this swap can take right now. Try a smaller amount.';
    case 'QUOTES_BUSY':
      return 'Prices are busy right now. Try again in a moment.';
    case 'NO_WALLET':
      return 'Your wallet isn’t ready yet. Close the swap and try again.';
    case 'UPGRADE_UNAVAILABLE':
      return 'Paid memberships aren’t available right now.';
    case 'UPGRADE_WRONG_TOKEN':
      return 'A membership is paid in USDC on Fuse.';
    case 'UPGRADE_FROM_FUSE':
      return 'Pick a coin on another network to pay with.';
    case 'UPGRADE_ALREADY_MEMBER':
      return 'You already have a membership, so there’s nothing to pay for.';
    case 'UPGRADE_UNPRICED':
      return `We can’t price ${from}, so it can’t pay for a membership. Pick another coin.`;
    case 'UPGRADE_TOO_MUCH':
      return 'That’s more than the membership costs. Swap a smaller amount.';
    case 'NOT_ENOUGH_BALANCE':
      return `You don’t have enough ${from}.`;
    case 'NOT_ENOUGH_GAS_MONEY':
      return ctx.gasMoney
        ? `This swap needs ${ctx.gasMoney}${ctx.network ? ` on ${ctx.network}` : ''} for its bridge fee.`
        : `This swap needs a little ${ctx.network ? `${ctx.network} ` : ''}coin for its bridge fee.`;
    case 'PRICE_CHANGED':
      return 'The price changed. Check the new amount and swap again.';
    case 'PRICE_IMPACT_TOO_HIGH':
      return 'This swap would lose too much to price impact. Try a smaller amount.';
    case 'SWAP_FAILED':
      return 'Nothing left your wallet. This was on our side, so please try again in a minute.';
    case 'QUOTE_UNAVAILABLE':
    default:
      return 'We couldn’t get a price. Try again in a moment.';
  }
}

/** What the main button reads while this error stands. */
export function swapErrorButtonLabel(code: SwapErrorCode, ctx: SwapErrorContext = {}): string {
  switch (code) {
    case 'NOT_ENOUGH_BALANCE':
      return `Not enough ${ctx.from ?? 'funds'}`;
    case 'NO_ROUTE':
    case 'TOKEN_NOT_SWAPPABLE':
    case 'SAME_TOKEN':
      return 'Pick another coin';
    case 'AMOUNT_TOO_LOW':
      return 'Amount too small';
    case 'AMOUNT_TOO_HIGH':
      return 'Amount too large';
    case 'PRICE_IMPACT_TOO_HIGH':
      return 'Price impact too high';
    case 'NOT_ENOUGH_GAS_MONEY':
      return 'Not enough for fees';
    default:
      return 'Try again';
  }
}
