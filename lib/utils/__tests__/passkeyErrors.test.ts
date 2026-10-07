/// <reference types="jest" />
import {
  getPasskeyErrorDetails,
  INSTANT_REFUSAL_MS,
  isCancelledByUser,
} from '@/lib/utils/passkeyErrors';

/** Turnkey's error class: `name` is always `TurnkeyError`, the reason is in `cause`. */
const turnkeyError = (message: string, code: string, cause?: unknown) =>
  Object.assign(new Error(message), { name: 'TurnkeyError', code, cause });

const domException = (name: string, message: string) => Object.assign(new Error(message), { name });

const CHROME_NOT_ALLOWED =
  'The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/#sctn-privacy-considerations-client.';
const SAFARI_NOT_ALLOWED =
  'The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.';

/** Native passkey errors are wrapped twice: by @turnkey/core, then by the wallet kit. */
const nativeError = (inner: unknown, coreMessage: string) =>
  turnkeyError(
    'Failed to create passkey',
    'UNKNOWN',
    turnkeyError(coreMessage, 'CREATE_PASSKEY_ERROR', inner),
  );

describe('getPasskeyErrorDetails', () => {
  describe('web', () => {
    it("reads Chrome's NotAllowedError under Turnkey's 'cancelled by the user' rewording", () => {
      const error = turnkeyError(
        'Passkey creation was cancelled by the user.',
        'SELECT_PASSKEY_CANCELLED',
        domException('NotAllowedError', CHROME_NOT_ALLOWED),
      );

      expect(getPasskeyErrorDetails(error, { elapsedMs: 6000 })).toEqual({
        kind: 'not_allowed',
        severity: 'info',
        code: 'SELECT_PASSKEY_CANCELLED',
        causeName: 'NotAllowedError',
        causeMessage: CHROME_NOT_ALLOWED,
      });
    });

    it("reads Safari's NotAllowedError, which Turnkey reports as a plain failure", () => {
      const error = turnkeyError(
        'Failed to create passkey',
        'CREATE_PASSKEY_ERROR',
        domException('NotAllowedError', SAFARI_NOT_ALLOWED),
      );

      expect(getPasskeyErrorDetails(error, { elapsedMs: 4200 })).toMatchObject({
        kind: 'not_allowed',
        code: 'CREATE_PASSKEY_ERROR',
        causeName: 'NotAllowedError',
      });
    });

    it('calls a NotAllowedError that arrives before any prompt could show a block, not a cancel', () => {
      const error = turnkeyError(
        'Failed to create passkey',
        'CREATE_PASSKEY_ERROR',
        domException('NotAllowedError', SAFARI_NOT_ALLOWED),
      );

      expect(getPasskeyErrorDetails(error, { elapsedMs: 12 }).kind).toBe('blocked');
      expect(getPasskeyErrorDetails(error, { elapsedMs: INSTANT_REFUSAL_MS }).kind).toBe(
        'not_allowed',
      );
      // Without a timing there is no evidence either way.
      expect(getPasskeyErrorDetails(error).kind).toBe('not_allowed');
    });

    it('reads the Credential Manager failures Chrome on Android reports', () => {
      for (const name of ['NotReadableError', 'OperationError', 'UnknownError']) {
        const error = turnkeyError(
          'Failed to create passkey',
          'CREATE_PASSKEY_ERROR',
          domException(name, 'An unknown error occurred while talking to the credential manager.'),
        );
        expect(getPasskeyErrorDetails(error, { elapsedMs: 300 })).toMatchObject({
          kind: 'device_setup',
          causeName: name,
        });
      }
    });

    it('reads a browser without passkey support', () => {
      expect(
        getPasskeyErrorDetails(
          turnkeyError(
            'Failed to create passkey',
            'CREATE_PASSKEY_ERROR',
            new Error('webauthn is not supported by this browser'),
          ),
        ),
      ).toEqual({
        kind: 'unsupported',
        severity: 'warning',
        code: 'CREATE_PASSKEY_ERROR',
        causeName: 'Error',
        causeMessage: 'webauthn is not supported by this browser',
      });

      expect(
        getPasskeyErrorDetails(
          turnkeyError(
            'Failed to create passkey',
            'CREATE_PASSKEY_ERROR',
            domException(
              'NotSupportedError',
              'The user agent does not support public key credentials.',
            ),
          ),
        ).kind,
      ).toBe('unsupported');
    });

    it('treats an aborted request as a cancel and a security error as a block', () => {
      const wrap = (cause: unknown) =>
        turnkeyError('Failed to create passkey', 'CREATE_PASSKEY_ERROR', cause);
      expect(getPasskeyErrorDetails(wrap(domException('AbortError', 'aborted'))).kind).toBe(
        'cancelled',
      );
      expect(
        getPasskeyErrorDetails(
          wrap(
            domException(
              'SecurityError',
              'The relying party ID is not a registrable domain suffix',
            ),
          ),
        ).kind,
      ).toBe('blocked');
    });

    it('leaves an InvalidStateError unclassified but still names it', () => {
      const error = turnkeyError(
        'Failed to create passkey',
        'CREATE_PASSKEY_ERROR',
        domException('InvalidStateError', 'A request is already pending.'),
      );
      expect(getPasskeyErrorDetails(error)).toMatchObject({
        kind: 'unknown',
        causeName: 'InvalidStateError',
      });
    });
  });

  describe('native', () => {
    it('reads a cancel from react-native-passkey under both Turnkey wrappers', () => {
      const error = nativeError(
        { error: 'UserCancelled', message: 'The user cancelled the request.' },
        'The user cancelled the request.',
      );

      expect(getPasskeyErrorDetails(error)).toEqual({
        kind: 'cancelled',
        severity: 'info',
        code: 'CREATE_PASSKEY_ERROR',
        causeName: 'UserCancelled',
        causeMessage: 'The user cancelled the request.',
      });
    });

    it("reads Android Credential Manager's own cancel wording", () => {
      for (const message of ['[16] Cancelled by user.', 'User canceled the request']) {
        const error = nativeError(new Error(message), message);
        expect(getPasskeyErrorDetails(error).kind).toBe('cancelled');
      }
    });

    it('reads a device that cannot hold passkeys', () => {
      const error = nativeError(
        {
          error: 'NotSupported',
          message:
            'Passkeys are not supported on this device. iOS 15 or Android SDK 28 and above is required to use Passkeys',
        },
        'Passkeys are not supported on this device.',
      );
      expect(getPasskeyErrorDetails(error)).toMatchObject({
        kind: 'unsupported',
        causeName: 'NotSupported',
      });
    });

    it('reads Google Play services and keychain failures as device setup', () => {
      expect(
        getPasskeyErrorDetails(
          nativeError(
            new Error('Unsuccessful result from folsom activity.'),
            'Unsuccessful result from folsom activity.',
          ),
        ).kind,
      ).toBe('device_setup');

      expect(
        getPasskeyErrorDetails(
          nativeError(
            {
              error: 'RequestFailed',
              message: 'The request failed. No Credentials were returned.',
            },
            'The request failed. No Credentials were returned.',
          ),
        ),
      ).toMatchObject({ kind: 'device_setup', causeName: 'RequestFailed' });
    });
  });

  it('copes with an error that has no cause, a string, and a cause cycle', () => {
    expect(
      getPasskeyErrorDetails(turnkeyError('Client is not initialized.', 'CLIENT_NOT_INITIALIZED')),
    ).toEqual({
      kind: 'unknown',
      severity: 'error',
      code: 'CLIENT_NOT_INITIALIZED',
      causeName: undefined,
      causeMessage: undefined,
    });

    expect(getPasskeyErrorDetails('boom').kind).toBe('unknown');
    expect(getPasskeyErrorDetails(undefined).kind).toBe('unknown');

    const cyclic: { name: string; message: string; cause?: unknown } = {
      name: 'TurnkeyError',
      message: 'Failed to create passkey',
    };
    cyclic.cause = cyclic;
    expect(getPasskeyErrorDetails(cyclic).kind).toBe('unknown');
  });

  it('caps the cause message it reports', () => {
    const error = turnkeyError(
      'Failed to create passkey',
      'CREATE_PASSKEY_ERROR',
      domException('UnknownError', 'x'.repeat(1000)),
    );
    expect(getPasskeyErrorDetails(error).causeMessage).toHaveLength(300);
  });
});

/**
 * React-native-passkey's errors as they arrive: login and unlock get them bare,
 * signup under Turnkey's two wrappers. Anything its switch does not know
 * becomes `{ error: 'Native error', message: String(error) }`.
 */
const rnPasskey = (error: string, message: string) => ({ error, message });

describe('severity', () => {
  // Modelled on what Sentry reported from signup, login and unlock in the 90
  // days to 21 September 2026, all of it filed at `error` (Sentry filtered
  // Facebook's message, so that one is Chrome's wording). BadConfiguration was
  // not among them: it is here because it is our own setup, so stays an error.
  it.each([
    [
      'Chrome: a prompt dismissed after it showed',
      'not_allowed',
      'info',
      turnkeyError(
        'Passkey creation was cancelled by the user.',
        'SELECT_PASSKEY_CANCELLED',
        domException('NotAllowedError', CHROME_NOT_ALLOWED),
      ),
    ],
    [
      'iOS and Android: UserCancelled',
      'cancelled',
      'info',
      rnPasskey('UserCancelled', 'The user cancelled the request.'),
    ],
    [
      'Android: Play services cancel code',
      'cancelled',
      'info',
      rnPasskey('Native error', 'Error: [16] Cancelled by user.'),
    ],
    [
      'Android: Credential Manager cancel',
      'cancelled',
      'info',
      rnPasskey('Native error', 'Error: User canceled the request'),
    ],
    [
      'Android: biometric prompt cancel',
      'cancelled',
      'info',
      rnPasskey('Native error', 'Error: User verification is cancelled by the user.'),
    ],
    [
      'Android: Credential Manager interrupted',
      'not_allowed',
      'info',
      rnPasskey('Interrupted', 'The operation was interrupted and may be retried.'),
    ],
    [
      'Facebook on Android: no passkey support (login, bare)',
      'unsupported',
      'warning',
      domException('NotSupportedError', 'The user agent does not support public key credentials.'),
    ],
    [
      'Android: too old for passkeys',
      'unsupported',
      'warning',
      rnPasskey(
        'NotSupported',
        'Passkeys are not supported on this device. iOS 15 or Android SDK 28 and above is required to use Passkeys',
      ),
    ],
    [
      'Android: Play services folsom',
      'device_setup',
      'warning',
      rnPasskey('Native error', 'Error: [50162] Unsuccessful result from folsom activity.'),
    ],
    [
      'Android: key creation failed after consent',
      'device_setup',
      'warning',
      rnPasskey('Native error', 'Error: Get Key Material failed after Record Consent.'),
    ],
    [
      'iOS: ASAuthorization request failed',
      'device_setup',
      'warning',
      rnPasskey('RequestFailed', 'The request failed. No Credentials were returned.'),
    ],
    [
      'Firefox: transient authenticator failure',
      'device_setup',
      'warning',
      domException('UnknownError', 'The operation failed for an unknown transient reason'),
    ],
    [
      'iOS: the app is not set up for the domain',
      'unknown',
      'error',
      rnPasskey(
        'BadConfiguration',
        'Your app is not properly configured. Refer to the docs for help.',
      ),
    ],
    [
      "react-native-passkey's catch-all",
      'unknown',
      'error',
      rnPasskey('Unknown error', 'An unknown error occurred'),
    ],
  ])('%s: %s, at %s', (_label, kind, severity, error) => {
    expect(getPasskeyErrorDetails(error, { elapsedMs: 5000 })).toMatchObject({ kind, severity });
  });

  it('keeps the wrapped signup errors at the same level as the bare ones', () => {
    const cancel = nativeError(
      rnPasskey('UserCancelled', 'The user cancelled the request.'),
      'Failed to create passkey',
    );
    expect(getPasskeyErrorDetails(cancel).severity).toBe('info');
  });

  it('calls an instant refusal a warning, and a security error ours to fix', () => {
    const refusal = turnkeyError(
      'Failed to create passkey',
      'CREATE_PASSKEY_ERROR',
      domException('NotAllowedError', SAFARI_NOT_ALLOWED),
    );
    expect(getPasskeyErrorDetails(refusal, { elapsedMs: 40 })).toMatchObject({
      kind: 'blocked',
      severity: 'warning',
    });

    const rpIdMismatch = turnkeyError(
      'Failed to create passkey',
      'CREATE_PASSKEY_ERROR',
      domException('SecurityError', 'The relying party ID is not a registrable domain suffix.'),
    );
    expect(getPasskeyErrorDetails(rpIdMismatch)).toMatchObject({
      kind: 'blocked',
      severity: 'error',
    });
  });

  it('leaves what it cannot place at error', () => {
    expect(getPasskeyErrorDetails(new Error('Error logging in')).severity).toBe('error');
    expect(
      getPasskeyErrorDetails(
        turnkeyError(
          'Failed to create passkey',
          'CREATE_PASSKEY_ERROR',
          domException('InvalidStateError', 'A request is already pending.'),
        ),
      ).severity,
    ).toBe('error');
  });
});

describe('isCancelledByUser', () => {
  it('recognises a dismissed prompt, including a signing one', () => {
    expect(isCancelledByUser(rnPasskey('UserCancelled', 'The user cancelled the request.'))).toBe(
      true,
    );
    // What the transaction hooks throw when `executeTransactions` reports a cancel.
    expect(isCancelledByUser(new Error('User cancelled transaction'))).toBe(true);
    expect(
      isCancelledByUser(
        Object.assign(new Error('Failed to sign: The user cancelled the request.'), {
          name: 'TurnkeyActivityError',
        }),
      ),
    ).toBe(true);
  });

  it("does not take Turnkey's rewording of a NotAllowedError as a cancel", () => {
    const error = turnkeyError(
      'Passkey creation was cancelled by the user.',
      'SELECT_PASSKEY_CANCELLED',
      domException('NotAllowedError', CHROME_NOT_ALLOWED),
    );
    expect(isCancelledByUser(error)).toBe(false);
  });

  it('is false for anything else', () => {
    expect(isCancelledByUser(new Error('Error logging in'))).toBe(false);
    expect(isCancelledByUser(new TypeError('Failed to fetch'))).toBe(false);
    expect(isCancelledByUser(undefined)).toBe(false);
  });
});
