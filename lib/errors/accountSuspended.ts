/**
 * Backend code for any request made by a suspended account: every call with its
 * session, a refresh, a sign-in and a recovery. An admin placed it and only an
 * admin can lift it, so retrying, refreshing or signing in again cannot help —
 * the only way forward is support.
 *
 * Kept apart from the 401 "session expired" path on purpose: telling a
 * suspended user their session expired sends them round a sign-in loop that
 * can never succeed.
 */
export const ACCOUNT_SUSPENDED_CODE = 'ACCOUNT_SUSPENDED';

export const ACCOUNT_SUSPENDED_TITLE = 'Account suspended';

export const ACCOUNT_SUSPENDED_MESSAGE =
  'Your Solid account has been suspended. Please contact support for help.';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const isResponse = (value: unknown): value is Response =>
  typeof Response !== 'undefined' && value instanceof Response;

/**
 * Whether a response body carries the code: at the top level, where the backend
 * puts it, or under `error`, the other shape `normalizeError` reads. Reading
 * both keeps the two in step, so a refusal described as a suspension always
 * ends the session as one.
 */
const bodyCarriesSuspendedCode = (body: Record<string, unknown> | null): boolean =>
  body?.code === ACCOUNT_SUSPENDED_CODE || asRecord(body?.error)?.code === ACCOUNT_SUSPENDED_CODE;

/**
 * Whether a thrown value says the account is suspended, from what it already
 * carries: an `ApiError`'s `code`, a parsed `{ code }` body, or an axios error's
 * `response.data` body. Synchronous, so it misses an unread `Response` — use
 * {@link readAccountSuspended} where one can arrive.
 */
export const isAccountSuspendedError = (error: unknown): boolean => {
  const record = asRecord(error);
  if (!record) return false;
  if (record.code === ACCOUNT_SUSPENDED_CODE) return true;
  return bodyCarriesSuspendedCode(asRecord(asRecord(record.response)?.data));
};

/**
 * {@link isAccountSuspendedError}, plus a raw `Response` this codebase throws
 * from `fetch` calls: its body is read from a clone, so whoever handles the
 * error next can still read it. Only a 403 is opened — the suspension refusal is
 * always one, and every other status would be a wasted read.
 */
export const readAccountSuspended = async (error: unknown): Promise<boolean> => {
  if (isAccountSuspendedError(error)) return true;
  if (!isResponse(error) || error.status !== 403 || error.bodyUsed) return false;
  try {
    return bodyCarriesSuspendedCode(asRecord(await error.clone().json()));
  } catch {
    return false;
  }
};
