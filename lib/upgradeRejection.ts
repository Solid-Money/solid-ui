/**
 * Reading the backend's answer to a `transfer`-mode upgrade confirm.
 *
 * Its own module, free of the bundler and wallet clients, so the hook and the
 * pending-upgrade settler can share it and tests can use it as it is.
 */

const statusOf = (error: unknown): unknown => (error as { status?: unknown } | null)?.status;

/** The message in a thrown response's body, if it has one. */
const backendMessage = async (error: unknown): Promise<string | null> => {
  try {
    const body = (await (error as Response).clone().json()) as { message?: unknown };
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  } catch {
    // No body to read.
  }
  return null;
};

/** What the backend says when it is not answering "try again" (a 4xx it means). */
export const upgradeRejectionMessage = async (error: unknown): Promise<string | null> => {
  const status = statusOf(error);
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
  return (
    (await backendMessage(error)) ??
    'We couldn’t confirm your upgrade. Contact support and we’ll sort it out — there is no need to pay again.'
  );
};

/**
 * The backend's two answers for a transaction that holds no payment from the
 * wallet at all — `readDirectPayment` in the accounts service: none of the
 * Safe's own operations in it ran, or none of them sent anything to Solid.
 */
const NO_PAYMENT_IN_TRANSACTION =
  /not a payment sent from your wallet|no payment from your wallet to Solid/i;

/**
 * Whether the backend answered that the transaction holds no payment from the
 * wallet: not a refusal of a payment, since there is none to refuse.
 *
 * A 400 like the refusals of a real payment (below the price, too old), so
 * only the wording tells them apart. A refusal leaves money at the treasury
 * and is held against a second payment; this means no money moved.
 */
export const isNoPaymentInTransaction = async (error: unknown): Promise<boolean> => {
  if (statusOf(error) !== 400) return false;
  const message = await backendMessage(error);
  return !!message && NO_PAYMENT_IN_TRANSACTION.test(message);
};
