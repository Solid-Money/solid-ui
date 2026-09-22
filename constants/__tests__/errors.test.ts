import {
  isUnlinkedPasskeyError,
  PASSKEY_ACCOUNT_NOT_FOUND_CODE,
  PASSKEY_NOT_REGISTERED_CODE,
} from '@/constants/errors';

/** The shape `login()` throws: ApiError sets `status` and `statusCode` alike. */
const apiError = (status: number, code?: string) => ({
  name: 'ApiError',
  status,
  statusCode: status,
  code,
  message: 'boom',
});

describe('isUnlinkedPasskeyError', () => {
  it('recognises both backend codes for a passkey that reaches no account', () => {
    expect(isUnlinkedPasskeyError(apiError(404, PASSKEY_NOT_REGISTERED_CODE))).toBe(true);
    expect(isUnlinkedPasskeyError(apiError(404, PASSKEY_ACCOUNT_NOT_FOUND_CODE))).toBe(true);
  });

  it('recognises the untyped 404 an older backend sends', () => {
    // Deployed backends predate the codes above and answer both cases with a
    // bare "User not found". The app still has to route those to recovery.
    expect(isUnlinkedPasskeyError(apiError(404))).toBe(true);
  });

  it('ignores a 404 that did not come from the login call', () => {
    // viem's HttpRequestError carries `status` but no `statusCode`, and the
    // login sequence calls an RPC host straight after authenticating. Reading
    // that as "your passkey has no account" would send the user to recovery
    // over a blip on someone else's server.
    expect(isUnlinkedPasskeyError({ status: 404, message: 'HTTP request failed.' })).toBe(false);
  });

  it('leaves every other login failure alone', () => {
    // A cancelled prompt, a closed account, a rate limit and a network blip all
    // need their own answer — none of them is "your passkey has no account".
    expect(isUnlinkedPasskeyError({ name: 'NotAllowedError' })).toBe(false);
    expect(isUnlinkedPasskeyError(apiError(403))).toBe(false);
    expect(isUnlinkedPasskeyError(apiError(429))).toBe(false);
    expect(isUnlinkedPasskeyError(new Error('Network request failed'))).toBe(false);
    expect(isUnlinkedPasskeyError(null)).toBe(false);
    expect(isUnlinkedPasskeyError(undefined)).toBe(false);
  });

  it('does not treat the string "404" as a 404', () => {
    expect(isUnlinkedPasskeyError({ status: '404', statusCode: '404' })).toBe(false);
  });
});
