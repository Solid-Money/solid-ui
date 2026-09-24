import { Address, encodeFunctionData, erc20Abi, Hex, maxUint256 } from 'viem';

import { formatUsd } from '@/constants/cardSpendModule';
import { SolidCashModuleV2_ABI } from '@/lib/abis/SolidCashModuleV2';

/**
 * Repaying a card credit position on `SolidCashModuleV2`: what a repayment would do, and
 * the calls that do it.
 *
 * Pure on purpose. The sheet quotes with it on every keystroke and the hook re-quotes with
 * it against a fresh read right before signing, so the figure a cardholder agreed to and the
 * calls that get signed come from one function rather than two that could drift.
 *
 * Two sources, matching the module's two Safe-callable repay paths:
 *
 *  - **wallet** — `repayFromSafe`, paying with a tender token the Safe holds loose. The module
 *    moves the tokens itself, so no allowance is involved while the module is enabled.
 *  - **collateral** — `repayFromCollateral`, paying with soUSD already escrowed against the
 *    loan. Priced as collateral rather than accepted as tender, so the tender list does not
 *    gate it and neither does a guardian's token pause.
 *
 * A repayment that clears the whole debt also sends every remaining escrowed balance back to
 * the wallet with `withdrawCollateral`, in the same signature: that call is only valid at zero
 * debt, and the batch is what gets it there.
 *
 * USD figures are 6-decimal, like everything else the module reports.
 */

const WAD = 10n ** 18n;
const ONE_CENT = 10_000n;
const MAX_BPS = 10_000n;

/**
 * Headroom a full repayment must clear before the batch also withdraws collateral.
 *
 * `withdrawCollateral` reverts while any debt remains, and a revert there fails the whole
 * batch — repayment included. Two things move between the read this is quoted from and the
 * block the operation lands in: interest keeps accruing, and a share price (soUSD) can be
 * reprinted. An hour of interest covers the first many times over at any rate the module
 * allows; ten basis points covers a reprint. Clearing both means the repayment is certain to
 * zero the debt; missing them only means collateral stays escrowed, never a failed batch.
 */
const ACCRUAL_BUFFER_SECONDS = 3_600n;
const PRICE_BUFFER_BPS = 10n;

export type RepaySourceKind = 'wallet' | 'collateral';

/** One way to pay the loan down, as the picker lists it. */
export interface RepaySource {
  /** `wallet:0x…` or `collateral:0x…`. The same token can be both. */
  id: string;
  kind: RepaySourceKind;
  token: Address;
  /** The on-chain ticker, for the icon lookup. */
  symbol: string;
  /** What the app calls it everywhere else — see {@link repayDisplaySymbol}. */
  displaySymbol: string;
  decimals: number;
  /** The module's own price, 6-decimal. Zero when it cannot price the token. */
  priceUsd: bigint;
  /** Token units: the Safe's loose balance, or what it has escrowed. */
  balance: bigint;
  /** {@link balance} at {@link priceUsd}, rounded down the way the module credits it. */
  valueUsd: bigint;
  /** Why this source cannot be used right now, or null when it can. */
  unavailableReason: string | null;
}

/** A balance the module holds for the Safe, which a full repayment returns. */
export interface EscrowedCollateral {
  token: Address;
  symbol: string;
  displaySymbol: string;
  decimals: number;
  priceUsd: bigint;
  amount: bigint;
}

export interface ReturnedCollateral {
  token: Address;
  displaySymbol: string;
  decimals: number;
  /** An estimate for display. The call itself withdraws whatever is left, exactly. */
  amount: bigint;
}

export interface RepayQuoteInput {
  debtUsd: bigint;
  borrowApyPerSecond: bigint;
  source: RepaySource;
  collateral: readonly EscrowedCollateral[];
  /** What the cardholder typed, or null when the field is empty. */
  amountUsd: bigint | null;
  /** MAX was pressed and nothing has been typed since. */
  isMax: boolean;
}

export type RepayQuote =
  | {
      ok: false;
      /** Why the repayment cannot go ahead, or null when there is simply nothing entered. */
      reason: string | null;
    }
  | {
      ok: true;
      /** Debt this retires, as quoted. The module prices it again at execution. */
      repayUsd: bigint;
      /** Clears the whole loan. */
      isFull: boolean;
      /**
       * Send `type(uint256).max` and let the module size it.
       *
       * Both repay paths clamp a max to what is actually available and owed, so this is how a
       * "repay everything" survives the interest that accrues between quote and inclusion — a
       * fixed figure quoted a minute earlier would leave a dust balance behind.
       */
      useMax: boolean;
      /** Token units for a partial wallet repayment. Null whenever the module sizes it. */
      tokenAmount: bigint | null;
      remainingDebtUsd: bigint;
      /** Balances the same signature sends back to the wallet. Empty unless {@link isFull}. */
      returnedCollateral: ReturnedCollateral[];
    };

/**
 * The name the app already uses for a token.
 *
 * The module allowlists USDC by its bridged contract, whose ticker is `USDC.e`, while the
 * card screen and the balance list both call it USDC. Showing the on-chain ticker here would
 * make the repay list the one place the same dollars go by a different name.
 */
export const repayDisplaySymbol = (symbol: string): string =>
  symbol.toUpperCase() === 'USDC.E' ? 'USDC' : symbol;

/** Token units to USD, rounded down — how the module values what a payer delivers. */
export const tokenToUsdFloor = (amount: bigint, priceUsd: bigint, decimals: number): bigint =>
  (amount * priceUsd) / 10n ** BigInt(decimals);

/** USD to token units, rounded up — how the module sizes what it takes. */
export const usdToTokenCeil = (usd: bigint, priceUsd: bigint, decimals: number): bigint => {
  if (priceUsd === 0n) return 0n;
  const numerator = usd * 10n ** BigInt(decimals);
  return (numerator + priceUsd - 1n) / priceUsd;
};

/** The debt as it could stand by the time the operation lands. See {@link ACCRUAL_BUFFER_SECONDS}. */
export const bufferedDebtUsd = (debtUsd: bigint, borrowApyPerSecond: bigint): bigint =>
  debtUsd +
  (debtUsd * borrowApyPerSecond * ACCRUAL_BUFFER_SECONDS) / WAD +
  (debtUsd * PRICE_BUFFER_BPS) / MAX_BPS +
  1n;

const roundUpToCent = (usd: bigint): bigint => ((usd + ONE_CENT - 1n) / ONE_CENT) * ONE_CENT;

/** The most a source can repay: the debt, or everything the source is worth if that is less. */
export const maxRepayableUsd = (debtUsd: bigint, source: RepaySource): bigint =>
  source.valueUsd < debtUsd ? source.valueUsd : debtUsd;

const whereHeld = (source: RepaySource): string =>
  source.kind === 'wallet' ? 'in your wallet' : 'in collateral';

/**
 * What repaying `amountUsd` from `source` would do, or why it cannot.
 *
 * Typing a figure that covers the debt — the debt itself, or the cent it rounds up to on
 * screen — is treated as repaying all of it. Anything beyond that cent is refused rather than
 * silently clamped: someone who typed $400 against a $304.77 loan has misread something, and
 * quietly repaying $304.77 would hide that from them.
 */
export const quoteRepay = ({
  debtUsd,
  borrowApyPerSecond,
  source,
  collateral,
  amountUsd,
  isMax,
}: RepayQuoteInput): RepayQuote => {
  if (debtUsd === 0n) return { ok: false, reason: 'You have nothing to repay.' };

  const hasEntry = isMax || (amountUsd !== null && amountUsd > 0n);
  if (!hasEntry) return { ok: false, reason: null };

  if (source.unavailableReason) return { ok: false, reason: source.unavailableReason };
  if (source.valueUsd === 0n) {
    return { ok: false, reason: `You have no ${source.displaySymbol} ${whereHeld(source)}.` };
  }

  const requested = isMax ? maxRepayableUsd(debtUsd, source) : (amountUsd as bigint);

  if (!isMax && requested > roundUpToCent(debtUsd)) {
    return { ok: false, reason: `You owe ${formatUsd(debtUsd)}.` };
  }

  const coversDebt = requested >= debtUsd;
  const shortfall = coversDebt ? source.valueUsd < debtUsd : requested > source.valueUsd;
  if (shortfall) {
    return {
      ok: false,
      reason: `Not enough ${source.displaySymbol} ${whereHeld(source)}. You have ${formatUsd(source.valueUsd)}.`,
    };
  }

  const isFull = coversDebt;
  const useMax = isMax || isFull;
  const repayUsd = isFull ? debtUsd : requested;

  return {
    ok: true,
    repayUsd,
    isFull,
    useMax,
    // Rounded up, so the module's rounded-down valuation still retires at least the figure
    // shown. Never above the balance: `requested` is at most the balance's rounded-down value.
    tokenAmount:
      source.kind === 'wallet' && !useMax
        ? usdToTokenCeil(requested, source.priceUsd, source.decimals)
        : null,
    remainingDebtUsd: debtUsd - repayUsd,
    returnedCollateral: isFull
      ? returnedOnFullRepay(debtUsd, borrowApyPerSecond, source, collateral)
      : [],
  };
};

/**
 * What a full repayment can safely send back, per escrowed token.
 *
 * Only when the source clears the debt with room to spare — see {@link bufferedDebtUsd}. A
 * token the repayment itself exhausts is left out, because withdrawing a zero balance reverts
 * (`AmountZero`) and would take the repayment down with it.
 */
const returnedOnFullRepay = (
  debtUsd: bigint,
  borrowApyPerSecond: bigint,
  source: RepaySource,
  collateral: readonly EscrowedCollateral[],
): ReturnedCollateral[] => {
  const buffered = bufferedDebtUsd(debtUsd, borrowApyPerSecond);
  if (source.valueUsd < buffered) return [];

  return collateral.flatMap(held => {
    if (held.amount === 0n) return [];

    const spendsThis = source.kind === 'collateral' && held.token === source.token;
    if (!spendsThis) {
      return [
        {
          token: held.token,
          displaySymbol: held.displaySymbol,
          decimals: held.decimals,
          amount: held.amount,
        },
      ];
    }

    const worstCaseSpent = usdToTokenCeil(buffered, source.priceUsd, source.decimals);
    if (worstCaseSpent >= held.amount) return [];

    return [
      {
        token: held.token,
        displaySymbol: held.displaySymbol,
        decimals: held.decimals,
        amount: held.amount - usdToTokenCeil(debtUsd, source.priceUsd, source.decimals),
      },
    ];
  });
};

/**
 * How many tokens a dollar figure is, for the line under the amount field.
 *
 * Exact only for a partial wallet repayment, where the quote carries the very token amount
 * that gets sent. Everywhere else the module sizes it at execution — a max, a full repayment,
 * anything from collateral — so the figure is the same round-up the module will apply, at
 * the price read a moment ago, and is marked as an estimate. A figure the quote refuses (too
 * much, say) still converts, because seeing what it is worth in tokens is part of seeing why.
 *
 * Null when there is nothing entered or no price to convert at.
 */
export const repayTokenEstimate = ({
  source,
  quote,
  debtUsd,
  amountUsd,
  isMax,
}: {
  source: RepaySource;
  quote: RepayQuote | null;
  debtUsd: bigint;
  amountUsd: bigint | null;
  isMax: boolean;
}): { amount: bigint; isExact: boolean } | null => {
  if (source.priceUsd === 0n) return null;

  if (quote?.ok) {
    if (quote.tokenAmount !== null) return { amount: quote.tokenAmount, isExact: true };
    return {
      amount: usdToTokenCeil(quote.repayUsd, source.priceUsd, source.decimals),
      isExact: false,
    };
  }

  const usd = isMax ? maxRepayableUsd(debtUsd, source) : amountUsd;
  if (usd === null || usd === 0n) return null;
  return { amount: usdToTokenCeil(usd, source.priceUsd, source.decimals), isExact: false };
};

export interface RepayCall {
  to: Address;
  data: Hex;
}

/**
 * The calls a quoted repayment becomes, in the order they must run.
 *
 * A wallet repayment normally goes through `repayFromSafe`, which has the module move the
 * tokens out of the Safe itself. That needs the module enabled, and a cardholder who has
 * revoked it still owes the debt — so for them it falls back to the permissionless `repay`,
 * behind an exact allowance that is cleared again afterwards so nothing is left approved.
 *
 * @throws when handed a quote that cannot be executed
 */
export const buildRepayCalls = ({
  safe,
  module,
  moduleEnabled,
  source,
  quote,
}: {
  safe: Address;
  module: Address;
  moduleEnabled: boolean;
  source: RepaySource;
  quote: RepayQuote;
}): RepayCall[] => {
  if (!quote.ok) throw new Error(quote.reason ?? 'Enter an amount to repay.');

  const calls: RepayCall[] = [];

  if (source.kind === 'collateral') {
    calls.push({
      to: module,
      data: encodeFunctionData({
        abi: SolidCashModuleV2_ABI,
        functionName: 'repayFromCollateral',
        args: [safe, source.token, quote.useMax ? maxUint256 : quote.repayUsd],
      }),
    });
  } else if (moduleEnabled) {
    const amount = quote.useMax ? maxUint256 : quote.tokenAmount;
    if (amount === null || amount === 0n) throw new Error('Enter an amount to repay.');

    calls.push({
      to: module,
      data: encodeFunctionData({
        abi: SolidCashModuleV2_ABI,
        functionName: 'repayFromSafe',
        args: [safe, source.token, amount],
      }),
    });
  } else {
    // `repay` does not clamp to the payer's balance the way `repayFromSafe` does, so a max
    // here is the whole balance. The module still pulls only what the debt needs.
    const amount = quote.useMax ? source.balance : quote.tokenAmount;
    if (amount === null || amount === 0n) throw new Error('Enter an amount to repay.');

    calls.push(
      {
        to: source.token,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [module, amount],
        }),
      },
      {
        to: module,
        data: encodeFunctionData({
          abi: SolidCashModuleV2_ABI,
          functionName: 'repay',
          args: [safe, source.token, amount],
        }),
      },
      {
        to: source.token,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [module, 0n] }),
      },
    );
  }

  for (const returned of quote.returnedCollateral) {
    // Max, because the module clamps it to what is left — the exact remainder depends on the
    // price and index at execution, which the quote can only estimate.
    calls.push({
      to: module,
      data: encodeFunctionData({
        abi: SolidCashModuleV2_ABI,
        functionName: 'withdrawCollateral',
        args: [returned.token, maxUint256],
      }),
    });
  }

  return calls;
};

/**
 * A typed dollar amount, trimmed to what the field accepts: digits and one decimal point,
 * at most two places.
 *
 * A comma is a decimal point when typed — it is what a European keyboard's decimal key
 * produces, and it turns into a dot on screen the moment it is entered. In a pasted figure it
 * is usually grouping instead, and reading "1,234.56" as $1.23 would repay a thousandth of
 * what was meant. So a comma is dropped as grouping when a dot is also present, when there is
 * more than one, or when exactly three digits follow it; only a bare "12,5" stays a decimal.
 */
export const sanitizeUsdAmountText = (text: string): string => {
  const commaCount = (text.match(/,/g) ?? []).length;
  const isGrouping =
    text.includes('.') || commaCount > 1 || /^\d+,\d{3}$/.test(text.replace(/[^\d,]/g, ''));
  const cleaned = (isGrouping ? text.replace(/,/g, '') : text.replace(/,/g, '.')).replace(
    /[^\d.]/g,
    '',
  );
  const [whole, ...rest] = cleaned.split('.');
  const trimmedWhole = whole.slice(0, 12);
  if (rest.length === 0) return trimmedWhole;
  return `${trimmedWhole}.${rest.join('').slice(0, 2)}`;
};

/** A sanitized dollar amount as 6-decimal USD, or null when there is no number in it. */
export const parseUsdAmountText = (text: string): bigint | null => {
  if (!/\d/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole || '0') * 1_000_000n + BigInt(`${fraction}00`.slice(0, 2)) * ONE_CENT;
};

/** 6-decimal USD as the plain figure the field shows: "304.77", no symbol or separators. */
export const usdToAmountText = (usd: bigint): string => (Number(usd) / 1_000_000).toFixed(2);

/** "3,676.84" — a token amount for display, to two places. */
export const formatRepayTokenAmount = (amount: bigint, decimals: number): string =>
  (Number(amount) / 10 ** decimals).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
