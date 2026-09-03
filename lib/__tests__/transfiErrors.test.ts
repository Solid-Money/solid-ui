/// <reference types="jest" />

import {
  asTransfiError,
  canCompleteProfile,
  toTransfiError,
  TRANSFI_ERROR_CODE,
  TransfiError,
  transfiErrorTitle,
} from '@/lib/transfiErrors';

/** A failed fetch carrying the backend's structured error body. */
const errorResponse = (status: number, body: unknown): Response =>
  ({ status, json: async () => body }) as Response;

describe('toTransfiError', () => {
  it('reads the code, action and copy the screens render', async () => {
    const error = await toTransfiError(
      errorResponse(400, {
        code: 'COUNTRY_NOT_SUPPORTED',
        action: 'none',
        message: 'Buying crypto isn’t available in your country yet.',
      }),
    );

    expect(error).toBeInstanceOf(TransfiError);
    expect(error.code).toBe('COUNTRY_NOT_SUPPORTED');
    expect(error.action).toBe('none');
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/isn’t available in your country/);
  });

  it('keeps the limits an amount failure carries', async () => {
    const error = await toTransfiError(
      errorResponse(400, {
        code: 'QUOTES_LIMIT_ERROR',
        action: 'adjust_amount',
        message: 'That amount is outside the limits for this payment method.',
        minLimit: 22,
        maxLimit: 86351.62,
        fiatCurrency: 'EUR',
      }),
    );

    expect(error.details).toMatchObject({ minLimit: 22, maxLimit: 86351.62, fiatCurrency: 'EUR' });
  });

  it('keeps the missing profile fields', async () => {
    const error = await toTransfiError(
      errorResponse(412, {
        code: TRANSFI_ERROR_CODE.PROFILE_DATA_INCOMPLETE,
        action: 'complete_kyc',
        message: 'Your verified profile is missing details.',
        missing: ['residential address'],
      }),
    );

    expect(error.details.missing).toEqual(['residential address']);
  });

  it('falls back to a retryable generic for a body that is not ours', async () => {
    // A gateway HTML page, or a 502 with no body — the screen still needs
    // something to say, which is the whole point of this path.
    const error = await toTransfiError({
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    } as unknown as Response);

    expect(error.code).toBe(TRANSFI_ERROR_CODE.UNKNOWN);
    expect(error.action).toBe('retry');
    expect(error.message).toMatch(/Nothing was charged/);
  });

  it('ignores an action the client does not know', async () => {
    const error = await toTransfiError(
      errorResponse(400, { code: 'SOMETHING_NEW', action: 'teleport', message: 'nope' }),
    );

    expect(error.action).toBe('retry');
    // The server's own sentence still survives — it is written for the user.
    expect(error.message).toBe('nope');
  });

  /** withRefreshToken keys the token refresh off `status`. */
  it('exposes the status so a 401 still reaches the refresh path', async () => {
    const error = await toTransfiError(errorResponse(401, {}));
    expect(error.status).toBe(401);
  });
});

describe('asTransfiError', () => {
  it('passes a TransfiError through unchanged', () => {
    const original = new TransfiError('KYC_PENDING', 'wait', 'still reviewing', 400);
    expect(asTransfiError(original)).toBe(original);
  });

  it('turns a dropped connection into something renderable', () => {
    const error = asTransfiError(new TypeError('Failed to fetch'));
    expect(error.action).toBe('retry');
    expect(error.message).not.toMatch(/fetch/);
  });
});

describe('transfiErrorTitle', () => {
  it('names the specific situation where there is one', () => {
    expect(transfiErrorTitle(new TransfiError('COUNTRY_NOT_SUPPORTED', 'none', '', 400))).toBe(
      'Not available in your country',
    );
  });

  it('falls back to a headline for the action', () => {
    expect(transfiErrorTitle(new TransfiError('SOME_NEW_CODE', 'adjust_amount', '', 400))).toBe(
      'Amount not accepted',
    );
  });
});

describe('canCompleteProfile', () => {
  const incomplete = (missing: string[]) =>
    new TransfiError(TRANSFI_ERROR_CODE.PROFILE_DATA_INCOMPLETE, 'complete_kyc', '', 412, {
      missing,
    });

  it('offers the form when every missing field is one a user can supply', () => {
    expect(canCompleteProfile(incomplete(['residential address']))).toBe(true);
    expect(canCompleteProfile(incomplete(['residential address', 'phone number']))).toBe(true);
  });

  it('refuses when a field comes from the verified identity', () => {
    // Retyping a name or date of birth would make the profile disagree with the
    // documents TransFi is about to be shown.
    expect(canCompleteProfile(incomplete(['residential address', 'date of birth']))).toBe(false);
    expect(canCompleteProfile(incomplete(['first name']))).toBe(false);
  });

  it('refuses when nothing was named, and for other codes', () => {
    expect(canCompleteProfile(incomplete([]))).toBe(false);
    expect(canCompleteProfile(new TransfiError('KYC_EXPIRED', 'complete_kyc', '', 400))).toBe(
      false,
    );
  });
});
