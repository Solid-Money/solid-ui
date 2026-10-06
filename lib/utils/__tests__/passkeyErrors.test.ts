/// <reference types="jest" />
import { getPasskeyErrorDetails, INSTANT_REFUSAL_MS } from '@/lib/utils/passkeyErrors';

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
