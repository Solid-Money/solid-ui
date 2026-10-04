import { OnboardingFeeProduct } from '@/lib/types';
import {
  clearPendingPayment,
  describePaymentError,
  describePaymentFailure,
  getPendingPayment,
  setPendingPayment,
} from '@/lib/utils/onboardingFeeRetry';

const CARD = OnboardingFeeProduct.RAIN_CARD;
const VIRTUAL_ACCOUNT = OnboardingFeeProduct.RAIN_VIRTUAL_ACCOUNT;

const PAYMENT = { transactionHash: `0x${'a'.repeat(64)}`, chainId: 122 };

/** A rejection shaped like the one the API client throws. */
const httpError = (status: number, message?: string): Response =>
  new Response(message ? JSON.stringify({ message }) : 'not json', {
    status,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => {
  clearPendingPayment(CARD);
  clearPendingPayment(VIRTUAL_ACCOUNT);
});

describe('pending payments', () => {
  it('remembers a payment so a retry confirms it instead of resending', () => {
    setPendingPayment(CARD, PAYMENT);

    expect(getPendingPayment(CARD)).toEqual(PAYMENT);
  });

  it('keeps the card fee and the virtual-account fee apart', () => {
    // Both are $10 to the same treasury, so a single shared slot would let one
    // payment settle both products.
    setPendingPayment(CARD, PAYMENT);

    expect(getPendingPayment(VIRTUAL_ACCOUNT)).toBeUndefined();
  });

  it('forgets a payment once it is credited', () => {
    setPendingPayment(CARD, PAYMENT);
    clearPendingPayment(CARD);

    expect(getPendingPayment(CARD)).toBeUndefined();
  });

  it('has nothing pending before anything is paid', () => {
    expect(getPendingPayment(CARD)).toBeUndefined();
  });
});

describe('describePaymentFailure', () => {
  it('keeps the payment pending when the server errors', async () => {
    // The money moved; the server failed to say so. Dropping it here is what
    // charges the user a second time.
    const { retryable } = await describePaymentFailure(httpError(503));

    expect(retryable).toBe(true);
  });

  it.each([408, 429])('keeps it pending on %i', async status => {
    const { retryable } = await describePaymentFailure(httpError(status));

    expect(retryable).toBe(true);
  });

  it('drops the payment when the server rejects it', async () => {
    // A 400 is a decision, not an outage. Retrying it forever would strand the
    // user on a transaction that will never be accepted.
    const { retryable } = await describePaymentFailure(
      httpError(400, 'That transaction did not pay the setup fee'),
    );

    expect(retryable).toBe(false);
  });

  it('keeps it pending when the request never reached the server', async () => {
    const { retryable } = await describePaymentFailure(new Error('Network request failed'));

    expect(retryable).toBe(true);
  });

  it('surfaces the server’s own reason', async () => {
    const { message } = await describePaymentFailure(
      httpError(409, 'That payment has already been used'),
    );

    expect(message).toBe('That payment has already been used');
  });
});

describe('describePaymentError', () => {
  it('falls back to a generic line when the body is unreadable', async () => {
    await expect(describePaymentError(httpError(500))).resolves.toBe(
      'Something went wrong paying the setup fee. Please try again.',
    );
  });

  it('says nothing when the user cancelled the signing prompt', async () => {
    await expect(describePaymentError(new Error('User cancelled the request'))).resolves.toBe('');
  });
});
