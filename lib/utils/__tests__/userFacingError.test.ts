/// <reference types="jest" />
import {
  GENERIC_ERROR_MESSAGE,
  isTechnicalErrorText,
  NETWORK_FEE_UNAVAILABLE_MESSAGE,
  NETWORK_UNREACHABLE_MESSAGE,
  redactSecrets,
  redactSecretsDeep,
  sanitizeDisplayText,
  USER_CANCELLED_MESSAGE,
  userFacingErrorMessage,
} from '@/lib/utils/userFacingError';

const FAKE_KEY = 'pim_TestKey1234567890abc';

/** The shape viem produced for the Sep 30 card-activation failure, key swapped out. */
const sponsorshipFailureMessage = [
  'An internal error was received.',
  '',
  `URL: https://api.pimlico.io/v2/122/rpc?apikey=${FAKE_KEY}`,
  'Request body: {"method":"pm_getPaymasterData","params":[{"callData":"0x541d63c8","paymaster":"0x777777777777AeC03fd955926DbF81597e66834C"},"0x0000000071727De22E5E9d8BAf0edAc6f37da032","0x7a",{"sponsorshipPolicyId":"sp_test"}]}',
  '',
  'Details: Insufficient Pimlico balance for sponsorship, please top up - Balance required: 0.000219 USD, Balance available: -1006.81455 USD',
  'Version: viem@2.47.10',
].join('\n');

const viemError = (message: string, details = '') =>
  Object.assign(new Error(message), {
    name: 'InternalRpcError',
    shortMessage: message.split('\n')[0],
    details,
    version: 'viem@2.47.10',
  });

describe('redactSecrets', () => {
  it('removes an API key from a URL query string', () => {
    const out = redactSecrets(`https://api.pimlico.io/v2/122/rpc?apikey=${FAKE_KEY}&x=1`);
    expect(out).not.toContain(FAKE_KEY);
    expect(out).toContain('apikey=[redacted]&x=1');
  });

  it('removes a bare Pimlico key and bearer tokens', () => {
    const out = redactSecrets(`key ${FAKE_KEY} sent with Authorization: Bearer abc.def.ghi`);
    expect(out).not.toContain(FAKE_KEY);
    expect(out).not.toContain('abc.def.ghi');
  });

  it('leaves ordinary copy untouched', () => {
    const copy = 'Cards are not available in Bangladesh (BD) yet.';
    expect(redactSecrets(copy)).toBe(copy);
  });
});

describe('isTechnicalErrorText', () => {
  it('flags the viem dump', () => {
    expect(isTechnicalErrorText(sponsorshipFailureMessage)).toBe(true);
  });

  it('flags JS runtime errors', () => {
    expect(
      isTechnicalErrorText("TypeError: Cannot read properties of undefined (reading 'x')"),
    ).toBe(true);
  });

  it('accepts short human copy', () => {
    expect(isTechnicalErrorText('Insufficient balance')).toBe(false);
    expect(isTechnicalErrorText('Invalid verification code. Please try again.')).toBe(false);
  });
});

describe('sanitizeDisplayText', () => {
  it('replaces a dump with the fallback', () => {
    expect(sanitizeDisplayText(sponsorshipFailureMessage)).toBe(GENERIC_ERROR_MESSAGE);
    expect(sanitizeDisplayText(sponsorshipFailureMessage, 'Nope')).toBe('Nope');
  });

  it('never returns the key, even through the fallback path', () => {
    expect(sanitizeDisplayText(`Failed: ${FAKE_KEY}`)).not.toContain(FAKE_KEY);
  });

  it('keeps human copy as is', () => {
    expect(sanitizeDisplayText('Withdrawal failed')).toBe('Withdrawal failed');
  });
});

describe('userFacingErrorMessage', () => {
  it('turns the reported card-activation failure into our own copy', () => {
    const out = userFacingErrorMessage(viemError(sponsorshipFailureMessage));
    expect(out).toBe(NETWORK_FEE_UNAVAILABLE_MESSAGE);
    expect(out).not.toContain(FAKE_KEY);
    expect(out).not.toContain('1006');
  });

  it('finds the sponsorship failure in a cause chain', () => {
    const outer = Object.assign(new Error('UserOperation failed'), {
      cause: viemError(sponsorshipFailureMessage),
    });
    expect(userFacingErrorMessage(outer)).toBe(NETWORK_FEE_UNAVAILABLE_MESSAGE);
  });

  it('does not call every user-op failure a sponsorship failure', () => {
    // Every sponsored op carries a `paymaster` field in the request body.
    const err = viemError(
      [
        'Signature provided for the User Operation is invalid.',
        `URL: https://api.pimlico.io/v2/122/rpc?apikey=${FAKE_KEY}`,
        'Request body: {"method":"eth_sendUserOperation","params":[{"paymaster":"0x7777"}]}',
        'Details: AA24 signature error',
        'Version: viem@2.47.10',
      ].join('\n'),
      'AA24 signature error',
    );
    expect(userFacingErrorMessage(err, 'Withdrawal failed.')).toBe('Withdrawal failed.');
  });

  it('never passes a viem message through, even a short one', () => {
    expect(userFacingErrorMessage(viemError('Execution reverted.'), 'Borrow failed.')).toBe(
      'Borrow failed.',
    );
  });

  it('recognises a dismissed passkey prompt', () => {
    const err = Object.assign(new Error('The operation either timed out or was not allowed.'), {
      name: 'NotAllowedError',
    });
    expect(userFacingErrorMessage(err)).toBe(USER_CANCELLED_MESSAGE);
  });

  it('recognises an unreachable network', () => {
    expect(userFacingErrorMessage(new TypeError('Network request failed'))).toBe(
      NETWORK_UNREACHABLE_MESSAGE,
    );
  });

  it('lets copy our own code or backend wrote through', () => {
    const apiError = Object.assign(new Error('Cards are not available in Bangladesh (BD) yet.'), {
      status: 400,
    });
    expect(userFacingErrorMessage(apiError)).toBe(
      'Cards are not available in Bangladesh (BD) yet.',
    );
    expect(userFacingErrorMessage(new Error('Insufficient balance'))).toBe('Insufficient balance');
  });

  it('falls back for empty, non-error and technical values', () => {
    expect(userFacingErrorMessage(undefined)).toBe(GENERIC_ERROR_MESSAGE);
    expect(userFacingErrorMessage({})).toBe(GENERIC_ERROR_MESSAGE);
    expect(userFacingErrorMessage(new Error(''), 'Try later')).toBe('Try later');
    expect(userFacingErrorMessage(new TypeError('x is not a function'), 'Try later')).toBe(
      'Try later',
    );
  });
});

describe('redactSecretsDeep', () => {
  it('scrubs strings nested in a Sentry-shaped event', () => {
    const event = {
      message: `boom ${FAKE_KEY}`,
      exception: { values: [{ value: `URL: https://x/rpc?apikey=${FAKE_KEY}` }] },
      breadcrumbs: [{ message: 'ok', data: { url: `https://x/rpc?apikey=${FAKE_KEY}`, n: 1 } }],
    };
    const out = redactSecretsDeep(event);
    expect(JSON.stringify(out)).not.toContain(FAKE_KEY);
    expect(out.breadcrumbs[0].data.n).toBe(1);
    expect(out.breadcrumbs[0].message).toBe('ok');
  });
});
