/// <reference types="jest" />

// execute.ts imports several native / blockchain modules that are not needed for
// isWebAuthnUserCancelledError. Mock them so Jest can load the module without
// native binaries or ESM-only packages.
import { isWebAuthnUserCancelledError } from '@/lib/execute';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.mock('permissionless', () => ({}));
jest.mock('permissionless/actions', () => ({}));
jest.mock('viem', () => ({}));
jest.mock('viem/account-abstraction', () => ({ entryPoint07Address: '0x' }));
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));

/**
 * Covers the iOS passkey cancellation bug: on iOS (Expo/React Native) a
 * dismissed passkey prompt surfaces as `{ name: 'UserCancelled', message:
 * 'The user cancelled the request.' }` rather than the web-standard
 * `NotAllowedError`. The helper must recognise both so callers can treat them
 * as benign warnings instead of exceptions.
 */
describe('isWebAuthnUserCancelledError', () => {
  it('matches the web-standard NotAllowedError name via message', () => {
    expect(isWebAuthnUserCancelledError({ name: 'NotAllowedError', message: 'not allowed' })).toBe(
      true,
    );
  });

  it('matches the iOS UserCancelled message', () => {
    expect(
      isWebAuthnUserCancelledError({
        name: 'UserCancelled',
        message: 'The user cancelled the request.',
      }),
    ).toBe(true);
  });

  it('matches other user-rejection message variants', () => {
    expect(isWebAuthnUserCancelledError({ message: 'The user denied the prompt.' })).toBe(true);
    expect(isWebAuthnUserCancelledError({ message: 'User rejected the credential.' })).toBe(true);
    expect(isWebAuthnUserCancelledError({ message: 'Aborted by the user' })).toBe(true);
    expect(
      isWebAuthnUserCancelledError({ message: 'Operation either timed out or was not allowed' }),
    ).toBe(true);
    expect(isWebAuthnUserCancelledError({ message: 'Failed to sign the transaction' })).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isWebAuthnUserCancelledError({ name: 'NetworkError', message: 'fetch failed' })).toBe(
      false,
    );
    expect(isWebAuthnUserCancelledError(null)).toBe(false);
    expect(isWebAuthnUserCancelledError(undefined)).toBe(false);
    expect(isWebAuthnUserCancelledError({})).toBe(false);
  });
});
