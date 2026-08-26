import {
  isPasskeyPromptError,
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
