import { DEPOSIT_MODAL } from '@/constants/modals';
import {
  canGoBackFromWalletTopUp,
  checkWalletTopUpAmount,
  formatWalletTopUpMoney,
  formatWalletTopUpTokenAmount,
  getWalletExecuteFailureAction,
  getWalletTopUpBackTarget,
  getWalletTopUpPlatform,
  getWalletTopUpProgress,
  getWalletTopUpQuoteErrorMessage,
  getWalletTopUpRowCopy,
  getWalletTopUpTitle,
  getWalletTopUpToken,
  HIDDEN_WALLET_TOPUP_ENTRY,
  isWalletTopUpAvailability,
  isWalletTopUpModal,
  isWalletTopUpQuoteResponse,
  isWalletTopUpSettled,
  readWalletTopUpResponse,
  resolveWalletTopUpEntry,
  sanitizeWalletTopUpAmount,
  toWalletTopUpRequestError,
  toWalletTopUpWireAmount,
  WALLET_TOPUP_INVALID_RESPONSE,
  WalletDeviceAvailability,
  WalletTopUpRequestError,
} from '@/lib/walletTopUp';

import type { WalletTopUpAvailability, WalletTopUpQuoteResponse } from '@/lib/types/wallet-topup';

const device = (overrides: Partial<WalletDeviceAvailability> = {}): WalletDeviceAvailability => ({
  applePay: false,
  googlePay: false,
  googlePayHandoff: false,
  googlePayNeedsCard: false,
  ...overrides,
});

describe('resolveWalletTopUpEntry', () => {
  it('stays hidden until the backend and the device have both answered', () => {
    expect(resolveWalletTopUpEntry('ios', false, device({ applePay: true }))).toEqual(
      HIDDEN_WALLET_TOPUP_ENTRY,
    );
    expect(resolveWalletTopUpEntry('ios', true, null)).toEqual(HIDDEN_WALLET_TOPUP_ENTRY);
  });

  it('offers Apple Pay on an iPhone that can pay, and nothing else there', () => {
    expect(resolveWalletTopUpEntry('ios', true, device({ applePay: true }))).toEqual({
      visible: true,
      method: 'apple_pay',
      needsCard: false,
    });
    expect(resolveWalletTopUpEntry('ios', true, device({ googlePay: true })).visible).toBe(false);
  });

  it('offers Google Pay on an Android phone that can pay, and nothing else there', () => {
    expect(resolveWalletTopUpEntry('android', true, device({ googlePay: true }))).toEqual({
      visible: true,
      method: 'google_pay',
      needsCard: false,
    });
    expect(resolveWalletTopUpEntry('android', true, device({ applePay: true })).visible).toBe(
      false,
    );
  });

  it('prefers Apple Pay on the web, then Google Pay natively or through the QR', () => {
    expect(
      resolveWalletTopUpEntry('web', true, device({ applePay: true, googlePayHandoff: true }))
        .method,
    ).toBe('apple_pay');
    expect(resolveWalletTopUpEntry('web', true, device({ googlePay: true })).method).toBe(
      'google_pay',
    );
    expect(resolveWalletTopUpEntry('web', true, device({ googlePayHandoff: true }))).toEqual({
      visible: true,
      method: 'google_pay',
      needsCard: false,
    });
  });

  it('keeps the Google Pay row, flagged, for an Android browser with no usable card', () => {
    expect(resolveWalletTopUpEntry('web', true, device({ googlePayNeedsCard: true }))).toEqual({
      visible: true,
      method: 'google_pay',
      needsCard: true,
    });
  });

  it('hides the row on a browser that can pay with neither', () => {
    expect(resolveWalletTopUpEntry('web', true, device())).toEqual(HIDDEN_WALLET_TOPUP_ENTRY);
  });
});

describe('getWalletTopUpPlatform', () => {
  it('names the apps, and everything else is the web', () => {
    expect(getWalletTopUpPlatform('ios')).toBe('ios');
    expect(getWalletTopUpPlatform('android')).toBe('android');
    expect(getWalletTopUpPlatform('web')).toBe('web');
    expect(getWalletTopUpPlatform('macos')).toBe('web');
  });
});

describe('getWalletTopUpRowCopy', () => {
  it('says where the card comes from', () => {
    expect(getWalletTopUpRowCopy('apple_pay', false)).toEqual({
      title: 'Apple Pay',
      subtitle: 'Top up instantly from a card in Apple Wallet',
    });
    expect(getWalletTopUpRowCopy('google_pay', false).subtitle).toBe(
      'Top up instantly from a card in Google Wallet',
    );
  });

  it('says to add a card first when there is none to pay with', () => {
    expect(getWalletTopUpRowCopy('google_pay', true).subtitle).toBe(
      'Add a card to Google Wallet to top up instantly',
    );
  });
});

describe('getWalletTopUpToken', () => {
  it('reads the backend’s payout token, falling back to the currency’s own', () => {
    expect(getWalletTopUpToken({ payoutTokens: { USD: 'USDC', EUR: 'EURC' } }, 'EUR')).toBe('EURC');
    expect(getWalletTopUpToken(undefined, 'USD')).toBe('USDC');
    expect(getWalletTopUpToken({ payoutTokens: {} }, 'EUR')).toBe('EURC');
  });
});

describe('amount', () => {
  const LIMIT = { min: '10.00', max: '500.00' };

  it('keeps digits and one point, and two decimals at most', () => {
    expect(sanitizeWalletTopUpAmount('1a2b3')).toBe('123');
    expect(sanitizeWalletTopUpAmount('12.345')).toBe('12.34');
    expect(sanitizeWalletTopUpAmount('1.2.3')).toBe('1.23');
    expect(sanitizeWalletTopUpAmount('12,5')).toBe('12.5');
    expect(sanitizeWalletTopUpAmount('100.')).toBe('100.');
  });

  it('checks an amount against the currency’s limits', () => {
    expect(checkWalletTopUpAmount('', LIMIT)).toBe('empty');
    expect(checkWalletTopUpAmount('100.', LIMIT)).toBe('invalid');
    expect(checkWalletTopUpAmount('0', LIMIT)).toBe('invalid');
    expect(checkWalletTopUpAmount('9.99', LIMIT)).toBe('below_min');
    expect(checkWalletTopUpAmount('10', LIMIT)).toBe('ok');
    expect(checkWalletTopUpAmount('500.00', LIMIT)).toBe('ok');
    expect(checkWalletTopUpAmount('500.01', LIMIT)).toBe('above_max');
  });

  it('accepts any positive amount when no limit is known', () => {
    expect(checkWalletTopUpAmount('1', undefined)).toBe('ok');
  });

  it('sends two decimals', () => {
    expect(toWalletTopUpWireAmount('100')).toBe('100.00');
    expect(toWalletTopUpWireAmount('25.5')).toBe('25.50');
  });
});

describe('formatting', () => {
  it('formats money with our symbol, or the code where we have none', () => {
    expect(formatWalletTopUpMoney('87.4', 'EUR')).toBe('€87.40');
    expect(formatWalletTopUpMoney('1000', 'USD')).toBe('$1,000.00');
    expect(formatWalletTopUpMoney('12', 'CHF')).toBe('12.00 CHF');
  });

  it('formats a token amount with its symbol after it', () => {
    expect(formatWalletTopUpTokenAmount('100', 'USDC')).toBe('100.00 USDC');
    expect(formatWalletTopUpTokenAmount('1234.5', 'EURC')).toBe('1,234.50 EURC');
    expect(formatWalletTopUpTokenAmount(' 87.40 ', 'EURC')).toBe('87.40 EURC');
    expect(formatWalletTopUpTokenAmount('100.', 'USDC')).toBe('100.00 USDC');
  });

  it('rounds a token amount to two decimals, half up', () => {
    expect(formatWalletTopUpTokenAmount('99.123456', 'USDC')).toBe('99.12 USDC');
    expect(formatWalletTopUpTokenAmount('1.005', 'USDC')).toBe('1.01 USDC');
    expect(formatWalletTopUpTokenAmount('99.995', 'USDC')).toBe('100.00 USDC');
    expect(formatWalletTopUpTokenAmount('0.004999', 'USDC')).toBe('0.00 USDC');
  });

  it('formats a token amount exactly, never through a float', () => {
    // An 18-decimal payout, and a whole part past 2^53: a double loses both.
    expect(formatWalletTopUpTokenAmount('12.344999999999999999', 'USDC')).toBe('12.34 USDC');
    expect(formatWalletTopUpTokenAmount('9007199254740993.005', 'USDC')).toBe(
      '9,007,199,254,740,993.01 USDC',
    );
  });

  it('shows a token amount that is not a plain decimal as it came', () => {
    expect(formatWalletTopUpTokenAmount('abc', 'USDC')).toBe('abc USDC');
    expect(formatWalletTopUpTokenAmount('1e3', 'USDC')).toBe('1e3 USDC');
    expect(formatWalletTopUpTokenAmount('-5', 'USDC')).toBe('-5 USDC');
  });
});

const AVAILABILITY: WalletTopUpAvailability = {
  available: true,
  reason: 'ok',
  capabilityStatus: 'Active',
  sdk: { webEnvironment: 'uat', mobileEnvironment: 'test', clientId: null },
  provider: 'checkout',
  walletConfig: { apple_pay: {} },
  currencies: ['USD', 'EUR'],
  defaultCurrency: 'USD',
  limits: { USD: { min: '10.00', max: '500.00' }, EUR: { min: '10.00', max: '500.00' } },
  payoutTokens: { USD: 'USDC', EUR: 'EURC' },
};

const QUOTE: WalletTopUpQuoteResponse = {
  estimationId: 'est-1',
  provider: 'checkout',
  walletConfig: { apple_pay: {} },
  checkoutToken: 'token-1',
  checkoutTokenExpiresAt: 1_700_000_000,
  quote: {
    estimationId: 'est-1',
    sourceAmount: { amount: '101.50', currency: 'USD' },
    destinationAmount: { amount: '100.00', currency: 'USDC' },
    fee: { amount: '1.50', currency: 'USD' },
    rate: null,
    expiresAtMs: 1_700_000_000_000,
  },
  payout: { token: 'USDC', chainId: 8453, amount: '100.00' },
};

describe('responses', () => {
  it('accepts a complete availability, and a "no" with nothing else to read', () => {
    expect(isWalletTopUpAvailability(AVAILABILITY)).toBe(true);
    expect(isWalletTopUpAvailability({ available: false, reason: 'not_in_cohort' })).toBe(true);
  });

  it('refuses a "yes" missing what the row and the amount step read', () => {
    const without = (key: keyof WalletTopUpAvailability) => {
      const { [key]: _dropped, ...rest } = AVAILABILITY;
      return rest;
    };
    expect(isWalletTopUpAvailability(without('limits'))).toBe(false);
    expect(isWalletTopUpAvailability(without('sdk'))).toBe(false);
    expect(isWalletTopUpAvailability(without('currencies'))).toBe(false);
    expect(isWalletTopUpAvailability({ ...AVAILABILITY, sdk: null })).toBe(false);
    expect(isWalletTopUpAvailability({ ...AVAILABILITY, currencies: [] })).toBe(false);
    expect(isWalletTopUpAvailability({ ...AVAILABILITY, defaultCurrency: 'GBP' })).toBe(false);
    expect(
      isWalletTopUpAvailability({ ...AVAILABILITY, limits: { USD: AVAILABILITY.limits.USD } }),
    ).toBe(false);
    expect(isWalletTopUpAvailability({ ...AVAILABILITY, limits: { USD: {}, EUR: {} } })).toBe(
      false,
    );
    expect(isWalletTopUpAvailability(null)).toBe(false);
    expect(isWalletTopUpAvailability({ available: 'yes' })).toBe(false);
  });

  it('accepts a complete quote, with or without a fee', () => {
    expect(isWalletTopUpQuoteResponse(QUOTE)).toBe(true);
    expect(isWalletTopUpQuoteResponse({ ...QUOTE, quote: { ...QUOTE.quote, fee: null } })).toBe(
      true,
    );
  });

  it('refuses a quote missing what the review step or the checkout reads', () => {
    const quoteWithout = (key: keyof WalletTopUpQuoteResponse['quote']) => {
      const { [key]: _dropped, ...rest } = QUOTE.quote;
      return { ...QUOTE, quote: rest };
    };
    expect(isWalletTopUpQuoteResponse({ ...QUOTE, quote: {} })).toBe(false);
    expect(isWalletTopUpQuoteResponse(quoteWithout('destinationAmount'))).toBe(false);
    expect(isWalletTopUpQuoteResponse(quoteWithout('sourceAmount'))).toBe(false);
    expect(isWalletTopUpQuoteResponse(quoteWithout('expiresAtMs'))).toBe(false);
    expect(
      isWalletTopUpQuoteResponse({
        ...QUOTE,
        quote: { ...QUOTE.quote, destinationAmount: { currency: 'USDC' } },
      }),
    ).toBe(false);
    expect(
      isWalletTopUpQuoteResponse({ ...QUOTE, quote: { ...QUOTE.quote, fee: { amount: 1 } } }),
    ).toBe(false);
    expect(isWalletTopUpQuoteResponse({ ...QUOTE, checkoutToken: '' })).toBe(false);
    expect(isWalletTopUpQuoteResponse({ ...QUOTE, estimationId: undefined })).toBe(false);
    expect(isWalletTopUpQuoteResponse({ ...QUOTE, walletConfig: null })).toBe(false);
    expect(isWalletTopUpQuoteResponse(undefined)).toBe(false);
  });

  const ok = (body: unknown) => ({ status: 200, json: async () => body }) as unknown as Response;

  it('hands a complete body over as it came', async () => {
    await expect(readWalletTopUpResponse(ok(QUOTE), isWalletTopUpQuoteResponse)).resolves.toBe(
      QUOTE,
    );
  });

  it('throws an incomplete body as a request error, which reads as ours', async () => {
    const error = await readWalletTopUpResponse(
      ok({ ...QUOTE, quote: {} }),
      isWalletTopUpQuoteResponse,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WalletTopUpRequestError);
    expect(error).toMatchObject({ status: 200, code: WALLET_TOPUP_INVALID_RESPONSE });
    expect(getWalletTopUpQuoteErrorMessage(error, 'apple_pay')).toBe(
      "We couldn't get a price right now. Try again.",
    );
  });
});

describe('status', () => {
  it('stops polling at completed, failed, expired and review', () => {
    expect(isWalletTopUpSettled('completed')).toBe(true);
    expect(isWalletTopUpSettled('failed')).toBe(true);
    expect(isWalletTopUpSettled('expired')).toBe(true);
    expect(isWalletTopUpSettled('review')).toBe(true);
    expect(isWalletTopUpSettled('quoted')).toBe(false);
    expect(isWalletTopUpSettled('pending')).toBe(false);
    expect(isWalletTopUpSettled('confirmed')).toBe(false);
    expect(isWalletTopUpSettled(undefined)).toBe(false);
  });

  const states = (status: Parameters<typeof getWalletTopUpProgress>[0]) =>
    getWalletTopUpProgress(status, 'apple_pay').map(row => row.state);

  it('names the wallet the user paid with', () => {
    expect(getWalletTopUpProgress('pending', 'google_pay').map(row => row.label)).toEqual([
      'Paid with Google Pay',
      'Confirmed by Wirex',
      'Added to your wallet',
    ]);
  });

  it('walks the three steps as the top-up moves', () => {
    expect(states(undefined)).toEqual(['active', 'pending', 'pending']);
    expect(states('quoted')).toEqual(['active', 'pending', 'pending']);
    expect(states('pending')).toEqual(['complete', 'active', 'pending']);
    expect(states('confirmed')).toEqual(['complete', 'complete', 'active']);
    expect(states('completed')).toEqual(['complete', 'complete', 'complete']);
  });

  it('marks the payment failed when nothing went through', () => {
    expect(states('failed')).toEqual(['failed', 'pending', 'pending']);
    expect(states('expired')).toEqual(['failed', 'pending', 'pending']);
  });
});

describe('getWalletExecuteFailureAction', () => {
  it('reads the status wherever money may have moved', () => {
    expect(getWalletExecuteFailureAction('already_executed')).toBe('reconcile');
    expect(getWalletExecuteFailureAction('network_error')).toBe('reconcile');
    expect(getWalletExecuteFailureAction('execute_failed')).toBe('reconcile');
  });

  it('quietly re-arms a quote or token that ran out', () => {
    expect(getWalletExecuteFailureAction('estimation_expired')).toBe('rearm');
    expect(getWalletExecuteFailureAction('execute_unauthorized')).toBe('rearm');
  });

  it('says so and re-arms for anything refused outright', () => {
    expect(getWalletExecuteFailureAction('execute_rejected')).toBe('retry');
    expect(getWalletExecuteFailureAction('something_new')).toBe('retry');
  });
});

describe('quote errors', () => {
  const respond = (status: number, body: unknown) =>
    ({
      status,
      json: async () => {
        if (body === undefined) throw new Error('no body');
        return body;
      },
    }) as unknown as Response;

  it('keeps the status and the backend’s message and code', async () => {
    const error = await toWalletTopUpRequestError(
      respond(403, { message: 'Not in cohort', code: 'not_in_cohort' }),
    );
    expect(error).toBeInstanceOf(WalletTopUpRequestError);
    expect(error.status).toBe(403);
    expect(error.code).toBe('not_in_cohort');
  });

  it('survives a body that is not JSON', async () => {
    const error = await toWalletTopUpRequestError(respond(502, undefined));
    expect(error.status).toBe(502);
    expect(error.message).toBe('');
  });

  it('shows the backend’s words for a limit, and ours otherwise', async () => {
    const tooSmall = await toWalletTopUpRequestError(
      respond(400, { message: 'Amount must be at least 10.00 USD' }),
    );
    expect(getWalletTopUpQuoteErrorMessage(tooSmall, 'apple_pay')).toBe(
      'Amount must be at least 10.00 USD',
    );

    const refused = await toWalletTopUpRequestError(respond(403, { message: 'internal detail' }));
    expect(getWalletTopUpQuoteErrorMessage(refused, 'google_pay')).toBe(
      "Google Pay top-ups aren't available on your account right now.",
    );

    const dailyLimit = await toWalletTopUpRequestError(respond(429, {}));
    expect(getWalletTopUpQuoteErrorMessage(dailyLimit, 'apple_pay')).toBe(
      "You've reached your top-up limit for now. Try again later.",
    );

    const upstream = await toWalletTopUpRequestError(respond(502, { message: 'Wirex 500' }));
    expect(getWalletTopUpQuoteErrorMessage(upstream, 'apple_pay')).toBe(
      "We couldn't get a price right now. Try again.",
    );
    expect(getWalletTopUpQuoteErrorMessage(new Error('offline'), 'apple_pay')).toBe(
      "We couldn't get a price right now. Try again.",
    );
  });
});

describe('flow', () => {
  it('knows its own steps', () => {
    expect(isWalletTopUpModal(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_AMOUNT)).toBe(true);
    expect(isWalletTopUpModal(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW)).toBe(true);
    expect(isWalletTopUpModal(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_STATUS)).toBe(true);
    expect(isWalletTopUpModal(DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT)).toBe(false);
    expect(isWalletTopUpModal(null)).toBe(false);
  });

  it('animates forward into every step from the chooser', () => {
    for (const modal of [
      DEPOSIT_MODAL.OPEN_WALLET_TOPUP_AMOUNT,
      DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW,
      DEPOSIT_MODAL.OPEN_WALLET_TOPUP_STATUS,
    ]) {
      expect(modal.number).toBeGreaterThan(DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE.number);
    }
    expect(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW.number).toBeGreaterThan(
      DEPOSIT_MODAL.OPEN_WALLET_TOPUP_AMOUNT.number,
    );
    expect(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_STATUS.number).toBeGreaterThan(
      DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW.number,
    );
  });

  it('titles the amount with the wallet and the review as such', () => {
    expect(getWalletTopUpTitle(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_AMOUNT, 'google_pay')).toBe(
      'Google Pay',
    );
    expect(getWalletTopUpTitle(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW, 'apple_pay')).toBe('Review');
    expect(getWalletTopUpTitle(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_STATUS, 'apple_pay')).toBe(
      undefined,
    );
  });

  it('goes back from the review to the amount, and from the amount to the row', () => {
    expect(getWalletTopUpBackTarget(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW)).toBe(
      DEPOSIT_MODAL.OPEN_WALLET_TOPUP_AMOUNT,
    );
    expect(getWalletTopUpBackTarget(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_AMOUNT)).toBe('entry');
  });

  it('leaves the flow from the status, with no back button there', () => {
    expect(getWalletTopUpBackTarget(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_STATUS)).toBe('close');
    expect(canGoBackFromWalletTopUp(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_STATUS)).toBe(false);
    expect(canGoBackFromWalletTopUp(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW)).toBe(true);
  });
});
