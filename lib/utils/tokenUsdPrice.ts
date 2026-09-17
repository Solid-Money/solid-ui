import { Currency, Price, Token } from '@cryptoalgebra/fuse-sdk';

/**
 * Decimal places kept on the USD-per-token figure.
 *
 * The subgraph hands us a JS number, and turning it into an exact ratio needs a
 * denominator. 12 places is enough that a micro-cap token priced at a
 * millionth of a cent still prices a fee to six significant figures, while
 * staying inside `Number.MAX_SAFE_INTEGER` for anything cheaper than ~$9,000
 * a token.
 */
const USD_PRECISION = 12;

/**
 * A `Price` for one whole unit of `currency` in `stable`, whose `quote()` is
 * correct.
 *
 * `Price` is a ratio of **raw** amounts, not of display amounts: `quote()`
 * multiplies the raw input by `numerator/denominator` and labels the result
 * with the quote currency, so the ratio has to carry both tokens' decimals.
 * Building it from a `CurrencyAmount`'s `numerator`/`denominator` — which is
 * `usdPerToken * 10^inputDecimals` over `1` — is the mistake this function
 * exists to prevent: it inflates every quote by `10^(2 * inputDecimals - 6)`,
 * which is a factor of 1e30 on an 18-decimal token. That produced swap fees of
 * $1.2e28 in the revenue dashboard from a real fee of about a cent.
 *
 * @param usdPerToken USD value of ONE WHOLE token, as the subgraph reports it.
 * @returns undefined when no usable price can be formed, so callers fall back
 * to recording no USD value rather than a wrong one.
 */
export function buildTokenUsdPrice(
  currency: Currency,
  usdPerToken: number,
  stable: Token,
): Price<Currency, Token> | undefined {
  if (!Number.isFinite(usdPerToken) || usdPerToken <= 0) return undefined;

  const usdScaled = BigInt(Math.round(usdPerToken * 10 ** USD_PRECISION));
  // A price too small to survive USD_PRECISION rounds to nothing. Reported as
  // "no price" rather than as zero-value revenue.
  if (usdScaled <= 0n) return undefined;

  // rawQuote = rawIn * numerator / denominator, and dividing that by the
  // stable's own decimals has to leave (rawIn / 10^inDecimals) * usdPerToken.
  const numerator = usdScaled * 10n ** BigInt(stable.decimals);
  const denominator = 10n ** BigInt(USD_PRECISION + currency.decimals);

  return new Price(
    currency,
    stable,
    denominator.toString(),
    numerator.toString(),
  );
}
