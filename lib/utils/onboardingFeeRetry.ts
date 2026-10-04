import { OnboardingFeeProduct } from '@/lib/types';

/**
 * Retrying a setup-fee payment without charging for it twice.
 *
 * A leaf module — no wagmi, no API client — for the same reason
 * `cardDepositGate` is one: these rules decide whether a user is charged a
 * second time, so they get direct coverage rather than being reachable only
 * through a mounted sheet that cannot easily be driven into "the transfer
 * landed but the confirmation did not".
 *
 * The asymmetry everything here exists for: the transfer is irreversible and
 * the confirmation is not. A confirmation that fails after the money has moved
 * must leave a record, or the next press sends a second payment.
 */

/** A payment that is on chain but not yet credited. */
export interface PendingPayment {
  transactionHash: string;
  chainId: number;
}

/**
 * Payments that reached the chain but whose confirmation has not yet succeeded.
 *
 * Module-level, not component state, and that is the point: the fee sheet
 * unmounts when dismissed, so a ref would forget the payment the moment the
 * user closed the sheet to go and check their balance — and the next press
 * would send another $10. Keyed by product because the card fee and the
 * virtual-account fee are paid separately and one must never settle the other.
 *
 * Survives dismissal and navigation; lost on a cold start. The server covers
 * that gap by logging an underpaid-but-collected payment at ERROR with the
 * hash and the payer, so support can credit anyone who falls through it.
 */
const pendingPayments = new Map<OnboardingFeeProduct, PendingPayment>();

export const getPendingPayment = (product: OnboardingFeeProduct): PendingPayment | undefined =>
  pendingPayments.get(product);

export const setPendingPayment = (product: OnboardingFeeProduct, payment: PendingPayment): void => {
  pendingPayments.set(product, payment);
};

export const clearPendingPayment = (product: OnboardingFeeProduct): void => {
  pendingPayments.delete(product);
};

/** What a failed confirmation means, and whether confirming again could help. */
export interface PaymentFailure {
  message: string;
  /**
   * True when the failure is about US rather than about the payment — a chain
   * we could not read, a price we could not fetch, a request that never
   * arrived. A 400 is the server having looked and decided, so repeating it is
   * pointless and leaving the payment pending on one would strand the user.
   */
  retryable: boolean;
}

const GENERIC = 'Something went wrong paying the setup fee. Please try again.';

/**
 * A message for the user out of whatever the payment threw.
 *
 * The API layer rejects with the `Response` itself, so the server's own reason
 * — "that transaction did not pay the setup fee", "that payment has already
 * been used" — is in the body and is the most useful thing we can say.
 */
export async function describePaymentError(caught: unknown): Promise<string> {
  if (typeof Response !== 'undefined' && caught instanceof Response) {
    try {
      const body = (await caught.json()) as { message?: string };
      return body?.message || GENERIC;
    } catch {
      return GENERIC;
    }
  }

  if (caught instanceof Error) {
    return caught.message.includes('cancel') ? '' : caught.message || GENERIC;
  }

  return GENERIC;
}

export async function describePaymentFailure(caught: unknown): Promise<PaymentFailure> {
  const message = await describePaymentError(caught);

  if (typeof Response !== 'undefined' && caught instanceof Response) {
    // 408 and 429 are "ask again", not "no".
    const retryable = caught.status >= 500 || caught.status === 408 || caught.status === 429;
    return { message, retryable };
  }

  // A thrown Error is a transport failure — the request may never have reached
  // the server, so the payment's state is unknown and must stay pending.
  return { message, retryable: true };
}
