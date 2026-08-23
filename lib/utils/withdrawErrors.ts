import { hexToString } from 'viem';

/**
 * Turning a failed withdrawal into something a person can act on.
 *
 * A UserOperation that reverts during simulation surfaces the callee's revert
 * data as raw hex inside the error message — viem decodes a top-level
 * `Error(string)` but not one nested inside a simulation failure. So the user
 * was shown "Error while withdrawing" while the actual reason,
 * `TRANSFER_FROM_FAILED`, sat encoded in a blob only a developer would read.
 */

/** Selector for Solidity's built-in `Error(string)` revert. */
const ERROR_STRING_SELECTOR = '08c379a0';

/** Standard `Error(string)` layout: 32-byte offset, 32-byte length, then bytes. */
const WORD = 64;

/**
 * Pull the revert string out of an `Error(string)` payload embedded anywhere in
 * `message`. Returns undefined when there is no such payload, or when what it
 * holds does not decode to readable text.
 */
export const decodeRevertReason = (message: string): string | undefined => {
  const index = message.toLowerCase().indexOf(ERROR_STRING_SELECTOR);
  if (index === -1) return undefined;

  const payload = message.slice(index + ERROR_STRING_SELECTOR.length).match(/^[0-9a-fA-F]+/)?.[0];
  if (!payload || payload.length < WORD * 2) return undefined;

  const length = Number.parseInt(payload.slice(WORD, WORD * 2), 16);
  if (!Number.isFinite(length) || length <= 0 || length > 256) return undefined;

  const body = payload.slice(WORD * 2, WORD * 2 + length * 2);
  if (body.length < length * 2) return undefined;

  try {
    const reason = hexToString(`0x${body}`);
    // Reject anything that decoded to control characters — that means the bytes
    // were not a string and we would be showing the user mojibake.
    return /^[\x20-\x7e]+$/.test(reason) ? reason : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Copy for the revert reasons this flow actually produces.
 *
 * `TRANSFER_FROM_FAILED` comes from the queue pulling soUSD off the account.
 * Requesting a withdrawal moves those shares into the queue, so the common way
 * to hit it is a second attempt against a balance the screen has not refreshed —
 * which is exactly the shape of the August reports: one person, one amount,
 * retried until they gave up.
 */
const FRIENDLY_REVERT_REASONS: Record<string, string> = {
  TRANSFER_FROM_FAILED:
    'Your soUSD balance has changed since this screen loaded — you may already have a withdrawal in the queue. Refresh and try again.',
};

/** Whether the user dismissed the signing prompt rather than anything failing. */
export const isUserCancelledError = (error: unknown): boolean =>
  String(error instanceof Error ? error.message : error)
    .toLowerCase()
    .includes('cancelled');

/**
 * A sentence to show the user for a failed withdrawal. Falls back to the decoded
 * revert reason, then to the raw message, so nothing is ever swallowed — but a
 * recognised reason always wins.
 */
export const describeWithdrawError = (error: unknown): string => {
  if (isUserCancelledError(error)) return 'Withdrawal cancelled.';

  const message = error instanceof Error ? error.message : String(error ?? '');
  const reason = decodeRevertReason(message);

  if (reason) {
    return FRIENDLY_REVERT_REASONS[reason] ?? `Withdrawal failed: ${reason}.`;
  }

  return 'Something went wrong with your withdrawal. Please try again.';
};
