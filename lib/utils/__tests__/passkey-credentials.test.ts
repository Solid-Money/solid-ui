import {
  buildRecoveryPasskeyName,
  isPasskeyPromptError,
  isTurnkeySessionError,
  isValidTurnkeyPasskeyName,
  mergeCredentialIds,
  tryBase64urlToUint8Array,
} from '@/lib/utils/passkey';

/**
 * Passkey recovery adds an authenticator to the Turnkey account rather than
 * replacing the lost one, so an account can hold several credentials. These
 * values become WebAuthn's `allowCredentials` on every in-app passkey prompt,
 * which is why dropping one strands whichever device holds it.
 */
describe('mergeCredentialIds', () => {
  const OLD = 'oAhWMPFN39CT9lJ1GNWzCA';
  const RECOVERED = 'Zm5ld0NyZWRlbnRpYWxJZA';
  const THIRD = 'dGhpcmRDcmVkZW50aWFs';

  it('adds a newly stamped credential to the known set', () => {
    expect(mergeCredentialIds([OLD], OLD, RECOVERED)).toEqual([OLD, RECOVERED]);
  });

  it('keeps the credentials the account already had', () => {
    // The stamp proves one passkey exists; it says nothing about the others,
    // so replacing the list would unpin the user's second device.
    expect(mergeCredentialIds([OLD, THIRD], OLD, RECOVERED)).toEqual([OLD, THIRD, RECOVERED]);
  });

  it('does not duplicate a credential that is already known', () => {
    expect(mergeCredentialIds([OLD, RECOVERED], OLD, RECOVERED)).toEqual([OLD, RECOVERED]);
  });

  it('promotes a legacy single credential into the list', () => {
    // Rows persisted before the list existed carry only the scalar.
    expect(mergeCredentialIds(undefined, OLD, RECOVERED)).toEqual([OLD, RECOVERED]);
  });

  it('falls back to the stamp alone when nothing is known', () => {
    expect(mergeCredentialIds(undefined, undefined, RECOVERED)).toEqual([RECOVERED]);
  });

  it('returns an empty list when there is nothing to remember', () => {
    // An empty pin is what leaves the next prompt unfiltered.
    expect(mergeCredentialIds(undefined, undefined, undefined)).toEqual([]);
  });

  it('keeps the known set when no passkey stamped', () => {
    expect(mergeCredentialIds([OLD], OLD, undefined)).toEqual([OLD]);
  });
});

/**
 * A signing prompt pinned to credentials the device does not hold fails the
 * same way a cancelled prompt does — WebAuthn refuses to distinguish them. The
 * matcher exists to decide when dropping the pin is worth it, not to diagnose.
 */
describe('isPasskeyPromptError', () => {
  it.each([
    ['iOS cancellation', { message: 'The user cancelled the request.' }],
    ['Android Credential Manager', { message: '[16] Cancelled by user.' }],
    ['WebAuthn DOMException', { name: 'NotAllowedError', message: 'not allowed' }],
    ['aborted ceremony', { name: 'AbortError', message: 'aborted' }],
    ['no matching credential', { message: 'No credentials available for this request' }],
    ['Turnkey credential lookup', { code: 'CREDENTIAL_NOT_FOUND', message: 'unknown' }],
    ['native exception', { message: 'androidx.credentials.NoCredentialException' }],
  ])('treats a %s as a passkey prompt failure', (_label, error) => {
    expect(isPasskeyPromptError(error)).toBe(true);
  });

  it.each([
    ['an on-chain revert', { message: 'execution reverted: insufficient balance' }],
    ['a bundler rejection', { message: 'UserOperation reverted during simulation' }],
    ['a network failure', { name: 'TypeError', message: 'Network request failed' }],
    ['a gas estimation failure', { message: 'Failed to get gas price' }],
  ])('leaves %s alone', (_label, error) => {
    // Dropping the pin here would be noise: the prompt already succeeded.
    expect(isPasskeyPromptError(error)).toBe(false);
  });

  it('handles a missing error without throwing', () => {
    expect(isPasskeyPromptError(null)).toBe(false);
    expect(isPasskeyPromptError(undefined)).toBe(false);
  });
});

/**
 * Credential ids are persisted on the device and replayed into
 * `allowCredentials` during render, so a corrupt one must degrade the filter
 * rather than throw out of the provider tree.
 */
describe('tryBase64urlToUint8Array', () => {
  it('decodes a base64url credential id', () => {
    expect(Array.from(tryBase64urlToUint8Array('AQID') ?? [])).toEqual([1, 2, 3]);
  });

  it('decodes ids using the url-safe alphabet and no padding', () => {
    // Real credential ids are unpadded and use `-`/`_` in place of `+`/`/`.
    expect(tryBase64urlToUint8Array('oAhWMPFN39CT9lJ1GNWzCA')).toHaveLength(16);
    expect(tryBase64urlToUint8Array('-_-_')).toHaveLength(3);
  });

  it('returns undefined for a value that is not base64url', () => {
    expect(tryBase64urlToUint8Array('not valid !!')).toBeUndefined();
  });
});

/**
 * Turnkey rejects an authenticator name outside its ASCII pattern before the
 * passkey prompt is ever shown, and rejects a name the account already holds.
 * The name the recovery flow sends therefore has to be locale-independent and
 * different on every attempt.
 */
describe('buildRecoveryPasskeyName', () => {
  it('produces a name Turnkey accepts', () => {
    expect(isValidTurnkeyPasskeyName(buildRecoveryPasskeyName(new Date(0)))).toBe(true);
  });

  it('stays within the 64 character limit', () => {
    expect(buildRecoveryPasskeyName(new Date(0)).length).toBeLessThanOrEqual(64);
  });

  it('is unique per attempt, not per day', () => {
    // Day granularity meant a second attempt on the same date re-sent a name
    // the account already had, which Turnkey refuses.
    const first = buildRecoveryPasskeyName(new Date('2026-09-07T09:51:00.123Z'));
    const second = buildRecoveryPasskeyName(new Date('2026-09-07T09:51:00.124Z'));
    expect(first).not.toEqual(second);
  });

  it('does not follow the device locale', () => {
    // `toLocaleDateString()` on an Arabic, Persian or Bengali device returns
    // non-Latin digits and embedded RTL marks, which the pattern rejects.
    const name = buildRecoveryPasskeyName(new Date('2026-09-07T09:51:00.000Z'));
    expect(name).toBe('Recovery Passkey - 2026-09-07T09:51:00.000Z');
    expect(name).not.toMatch(/[^\x20-\x7E]/);
  });
});

describe('isValidTurnkeyPasskeyName', () => {
  it('rejects the Arabic-locale date the flow used to send', () => {
    // ar-EG `toLocaleDateString()`: Arabic-Indic digits plus U+200F RTL marks.
    expect(isValidTurnkeyPasskeyName('Recovery Passkey - ٧‏/٩‏/٢٠٢٦')).toBe(false);
  });

  it('accepts the en-US date the flow used to send', () => {
    // Which is why this only ever failed for some users.
    expect(isValidTurnkeyPasskeyName('Recovery Passkey - 9/7/2026')).toBe(true);
  });

  it('rejects a name longer than 64 characters', () => {
    expect(isValidTurnkeyPasskeyName('a'.repeat(65))).toBe(false);
  });
});

/**
 * A recovery session is minted from a single-use code and cannot be renewed
 * from the add-passkey screen, so a lapsed session has to be told apart from a
 * failure that a retry could clear.
 */
describe('isTurnkeySessionError', () => {
  it.each([
    ['the SDK session code', { code: 'SESSION_EXPIRED', message: 'Session API key has expired' }],
    ['a missing session', { code: 'NO_SESSION_FOUND', message: 'No active session found.' }],
    ['an expired api key', { message: 'Unauthenticated desc = expired api key publicKey 02ab' }],
    ['an unknown public key', { message: 'could not find public key in organization' }],
  ])('recognises %s', (_label, error) => {
    expect(isTurnkeySessionError(error)).toBe(true);
  });

  it('finds the session failure the SDK hid behind its own message', () => {
    // `addPasskey` wraps everything downstream of the prompt in a bare
    // "Failed to add passkey" and leaves the real error on `cause`.
    expect(
      isTurnkeySessionError({
        code: 'ADD_PASSKEY_ERROR',
        message: 'Failed to add passkey',
        cause: { message: 'Unauthenticated desc = expired api key publicKey 02ab' },
      }),
    ).toBe(true);
  });

  it.each([
    [
      'a duplicate name',
      { code: 'ADD_PASSKEY_ERROR', message: 'authenticator name already exists' },
    ],
    ['a cancelled prompt', { code: 'SELECT_PASSKEY_CANCELLED', message: 'cancelled by the user' }],
    ['a network failure', { name: 'TypeError', message: 'Network request failed' }],
  ])('leaves %s to the retry path', (_label, error) => {
    // These can clear on retry, so they must not throw away the session.
    expect(isTurnkeySessionError(error)).toBe(false);
  });

  it('handles a missing error and a cyclic cause without hanging', () => {
    expect(isTurnkeySessionError(null)).toBe(false);
    const cyclic: { message: string; cause?: unknown } = { message: 'boom' };
    cyclic.cause = cyclic;
    expect(isTurnkeySessionError(cyclic)).toBe(false);
  });
});
