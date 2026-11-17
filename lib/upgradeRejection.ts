/**
 * Reading the backend's answer to a `transfer`-mode upgrade confirm.
 *
 * Its own module, free of the bundler and wallet clients, so the hook and the
 * pending-upgrade settler can share it and tests can use it as it is.
 */

/** What the backend says when it is not answering "try again" (a 4xx it means). */
export const upgradeRejectionMessage = async (error: unknown): Promise<string | null> => {
  const status = (error as { status?: unknown } | null)?.status;
  // 401 is a session to refresh, 408 and 429 are transient; 5xx is "not yet".
  if (
    typeof status !== 'number' ||
    status < 400 ||
    status >= 500 ||
    status === 401 ||
    status === 408 ||
    status === 429
  ) {
    return null;
  }
  try {
    const body = (await (error as Response).clone().json()) as { message?: unknown };
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  } catch {
    // Fall through to the generic wording.
  }
  return 'We couldn’t confirm your upgrade. Contact support and we’ll sort it out — there is no need to pay again.';
};
