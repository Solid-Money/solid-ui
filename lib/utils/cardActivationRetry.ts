import type { CardActivationFailure } from '@/lib/types';

/**
 * Failure codes the user may always retry, whatever `terminal` says.
 *
 * These name faults that sit outside the applicant and end on their own — an
 * issuer outage, a provisioning window, a blip upstream. The backend now
 * classifies them non-terminal and rewrites the flag on read, so in the normal
 * case `terminal` already answers this. The set is kept here as well because
 * the September 2026 i2C outage showed what the alternative costs: rows written
 * while `ISSUER_DECLINED` was terminal disabled the only button on the screen,
 * and the flag is cleared solely by an issuance succeeding — which the disabled
 * button made impossible. A client that can reach the same conclusion on its
 * own cannot be stranded by a stale row or by the two deploys landing out of
 * order.
 *
 * Everything absent from this set defers entirely to `terminal`: an unsupported
 * document country or a name the issuer cannot read is not retried away.
 */
export const RETRYABLE_ACTIVATION_FAILURE_CODES: ReadonlySet<string> = new Set([
  'ISSUER_DECLINED',
  'ACTIVATION_PENDING',
  'TEMPORARY_FAILURE',
]);

/**
 * Whether the card screen should offer this failure a retry.
 *
 * True for anything non-terminal, and for the codes above even when the stored
 * row still calls them terminal.
 */
export function isActivationFailureRetryable(
  failure: CardActivationFailure | null | undefined,
): boolean {
  if (!failure) return false;
  if (RETRYABLE_ACTIVATION_FAILURE_CODES.has(failure.code)) return true;
  return !failure.terminal;
}

/**
 * Whether a failure should gate the activate step and hide the "on its way"
 * screen — i.e. the inverse of the above, for a failure that exists at all.
 *
 * Kept as its own function rather than negating at each call site: the two
 * call sites (`useCardSteps`, `isCardIssuanceUnderReview`) previously read
 * `activationFailure?.terminal` directly, and that is exactly the expression
 * that has to stop being duplicated.
 */
export function blocksCardActivation(failure: CardActivationFailure | null | undefined): boolean {
  if (!failure) return false;
  return !isActivationFailureRetryable(failure);
}
