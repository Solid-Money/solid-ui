import {
  ACCOUNT_SUSPENDED_MESSAGE,
  ACCOUNT_SUSPENDED_TITLE,
  isAccountSuspendedError,
  readAccountSuspended,
} from '@/lib/errors/accountSuspended';
import { describeError, normalizeError } from '@/lib/errors/classify';

describe('isAccountSuspendedError', () => {
  it.each([
    ['an ApiError', { status: 403, code: 'ACCOUNT_SUSPENDED' }],
    ['an axios error', { response: { status: 403, data: { code: 'ACCOUNT_SUSPENDED' } } }],
  ])('recognises %s', (_label, error) => {
    expect(isAccountSuspendedError(error)).toBe(true);
  });

  it.each([
    ['another code', { status: 403, code: 'ACCOUNT_SECURITY_CLOSED' }],
    ['a bare 403', { status: 403 }],
    ['null', null],
    ['a string', 'ACCOUNT_SUSPENDED'],
  ])('does not match %s', (_label, error) => {
    expect(isAccountSuspendedError(error)).toBe(false);
  });
});

describe('readAccountSuspended', () => {
  const response = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  it('reads a 403 Response body without consuming it', async () => {
    if (typeof Response === 'undefined') return;
    const res = response(403, { code: 'ACCOUNT_SUSPENDED' });
    await expect(readAccountSuspended(res)).resolves.toBe(true);
    expect(res.bodyUsed).toBe(false);
  });

  it('leaves other statuses unread', async () => {
    if (typeof Response === 'undefined') return;
    const res = response(401, { code: 'ACCOUNT_SUSPENDED' });
    await expect(readAccountSuspended(res)).resolves.toBe(false);
  });

  it('is false for a body that is not JSON', async () => {
    if (typeof Response === 'undefined') return;
    await expect(readAccountSuspended(new Response('nope', { status: 403 }))).resolves.toBe(false);
  });
});

describe('describeError for a suspended account', () => {
  it('says the account is suspended, not that the session expired', () => {
    const error = describeError(
      normalizeError({
        status: 403,
        statusCode: 403,
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account is suspended. Contact support.',
      }),
      { action: 'sign_in' },
    );
    expect(error.title).toBe(ACCOUNT_SUSPENDED_TITLE);
    expect(error.body).toBe(ACCOUNT_SUSPENDED_MESSAGE);
  });
});
