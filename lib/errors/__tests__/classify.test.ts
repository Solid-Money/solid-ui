/// <reference types="jest" />

import { onlineManager } from '@tanstack/react-query';

import {
  classifyError,
  getUserErrorMessage,
  isSafeServerMessage,
  normalizeError,
  normalizeErrorAsync,
  toUserError,
} from '@/lib/errors/classify';
import { UserCopyError } from '@/lib/errors/UserCopyError';

/** The shape `lib/api`'s ApiError has; the classifier reads it by duck type. */
class ApiError extends Error {
  readonly status: number;
  readonly statusCode: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(status: number, message: string, code?: string, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.requestId = requestId;
  }
}

/** The error that reached a user's toast verbatim (key redacted). */
const PIMLICO_ERROR = new Error(
  [
    'Invalid parameters were provided to the RPC method.',
    'Double check you have provided the correct parameters.',
    '',
    'URL: https://api.pimlico.io/v2/8453/rpc?apikey=pim_REDACTEDREDACTED',
    'Request body: {"method":"pm_getPaymasterData","params":[{"callData":"0x541d63c8"}]}',
    '',
    'Details: invalid params',
    'Version: viem@2.47.6',
  ].join('\n'),
);

const RID = '9c1b4f2a0e6d4b7f8a1c2d3e4f5a6b7c';

describe('toUserError', () => {
  it.each([
    'Your wallet is still setting up. Please try again shortly.',
    'Real-Time Funding is not available for this card right now.',
    'This network isn’t supported by this version of the app. Please update and try again.',
    'This tier is not available with an annual fee.',
  ])('preserves app-authored recovery instructions: %s', message => {
    expect(getUserErrorMessage(new UserCopyError(message))).toBe(message);
    expect(getUserErrorMessage(new Error(message))).not.toBe(message);
  });
  it('turns the paymaster failure into "what failed" and "nothing was sent"', () => {
    const userError = toUserError(PIMLICO_ERROR, {
      action: 'move_to_card',
      details: { amount: '50', token: 'USDC' },
    });

    expect(userError).toMatchObject({
      kind: 'blockchain',
      code: 'PAYMASTER_REJECTED',
      title: 'Couldn’t move to your card',
      body: 'Nothing was sent. Your 50 USDC hasn’t moved. Try again in a moment.',
      nothingSent: true,
      silent: false,
    });
    // The technical cause is kept for telemetry, minus the key and the request dump.
    expect(userError.technical).not.toContain('pim_');
    expect(userError.technical).not.toContain('callData');
  });

  it('says nothing when the user backed out of the passkey or wallet prompt', () => {
    for (const error of [
      Object.assign(new Error('The operation either timed out or was not allowed.'), {
        name: 'NotAllowedError',
      }),
      new Error('[16] Cancelled by user.'),
      new Error('User cancelled transaction'),
      Object.assign(new Error('User rejected the request.'), { code: 4001 }),
    ]) {
      expect(toUserError(error, { action: 'send' }).silent).toBe(true);
    }
  });

  it('keeps our own 4xx copy and drops relayed provider text', () => {
    expect(
      toUserError(new ApiError(400, 'That amount is below the minimum'), { action: 'deposit' })
        .body,
    ).toBe('That amount is below the minimum.');

    expect(
      toUserError(
        new ApiError(502, 'Rain API error in getRainCardById: 404 - {"statusCode":404}'),
        {
          action: 'card_reveal',
        },
      ).body,
    ).toBe('Something went wrong on our side. Try again in a moment.');

    expect(
      toUserError(new ApiError(400, 'Turnkey relay failed: invalid stamp'), { action: 'sign_in' })
        .body,
    ).toBe('Check the details and try again.');
  });

  it('carries the request ID the backend returned', () => {
    const userError = toUserError(new ApiError(500, 'Internal server error', undefined, RID));
    expect(userError).toMatchObject({ kind: 'server', code: 'HTTP_500', requestId: RID });
  });

  it('never claims nothing was sent once a transaction may have gone out', () => {
    const userError = toUserError(
      Object.assign(new Error('Timed out while waiting for transaction with hash 0xabc'), {
        name: 'WaitForTransactionReceiptTimeoutError',
      }),
      { action: 'send' },
    );
    expect(userError).toMatchObject({ code: 'RECEIPT_TIMEOUT', nothingSent: false });
    expect(userError.body).toBe(
      'It may still go through. Check your activity before trying again.',
    );
  });

  it('names an expired session instead of the action', () => {
    expect(toUserError(new ApiError(401, 'Unauthorized'), { action: 'send' })).toMatchObject({
      kind: 'session',
      title: 'Your session expired',
    });
  });

  it('reads offline failures as connectivity, not as our fault', () => {
    expect(toUserError(new TypeError('Network request failed')).kind).toBe('offline');

    const spy = jest.spyOn(onlineManager, 'isOnline').mockReturnValue(false);
    expect(toUserError(new Error('anything')).kind).toBe('offline');
    spy.mockRestore();
  });

  it('falls back to a plain, actionable line for the unknown', () => {
    expect(getUserErrorMessage(new Error("Cannot read property 'name' of undefined"))).toBe(
      'Try again in a moment. If it keeps happening, contact support.',
    );
  });
});

describe('classifyError', () => {
  it.each([
    ['UserOperation reverted during simulation with reason: 0x', 'SIMULATION_REVERTED', true],
    ['AA21 didn’t pay prefund', 'USEROP_AA21', true],
    ['execution reverted: ERC20: transfer amount exceeds balance', 'INSUFFICIENT_FUNDS', true],
    ['Transaction reverted on-chain', 'TX_REVERTED', undefined],
  ])('%s → %s', (message, code, nothingSent) => {
    const result = classifyError(normalizeError(new Error(message)));
    expect(result.code).toBe(code);
    expect(result.nothingSent).toBe(nothingSent);
  });
});

describe('normalizeErrorAsync', () => {
  it('reads the status, request ID and message of a thrown Response', async () => {
    const response = new Response(
      JSON.stringify({
        statusCode: 409,
        message: 'That payment has already been used',
        requestId: RID,
      }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    );

    const normalized = await normalizeErrorAsync(response);

    expect(normalized).toMatchObject({
      status: 409,
      requestId: RID,
      serverMessage: 'That payment has already been used',
    });
  });

  it('reads axios errors', () => {
    const normalized = normalizeError({
      isAxiosError: true,
      message: 'Request failed with status code 503',
      response: { status: 503, data: { message: 'down' }, headers: { 'x-request-id': RID } },
      config: { url: 'https://api.solid.xyz/accounts/v1/points?token=abc' },
    });
    expect(normalized).toMatchObject({ status: 503, requestId: RID, path: '/accounts/v1/points' });
  });
});

describe('isSafeServerMessage', () => {
  it.each([
    ['That amount is below the minimum', true],
    ['Cards are not available in Bangladesh (BD) yet.', true],
    ['Internal server error', false],
    ['Request failed with status code 500', false],
    ['{"statusCode":404}', false],
    ['See https://docs.example.com', false],
    ['Wirex API error: Entity not found', false],
    ['TypeError: x is undefined', false],
    ['', false],
    [undefined, false],
  ])('%s → %s', (message, safe) => {
    expect(isSafeServerMessage(message)).toBe(safe);
  });
});
