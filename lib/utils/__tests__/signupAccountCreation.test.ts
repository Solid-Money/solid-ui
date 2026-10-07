/// <reference types="jest" />
import {
  getAccountCreationRecovery,
  getAccountCreationSeverity,
  getAccountCreationStatus,
  isRateLimitedError,
} from '@/lib/utils/signupAccountCreation';

/** The shape `emailSignUp` throws for a non-2xx reply: the server's message plus the status. */
const apiError = (status: number, message: string) =>
  Object.assign(new Error(message), { status, data: { statusCode: status, message } });

describe('getAccountCreationRecovery', () => {
  it('keeps the passkey for every failure the server reports before using it', () => {
    expect(getAccountCreationRecovery(apiError(409, 'This username is already taken'))).toBe(
      'choose_username',
    );
    expect(getAccountCreationRecovery(apiError(401, 'Invalid or expired verification token'))).toBe(
      'verify_email',
    );
    expect(getAccountCreationRecovery(apiError(409, 'Email already registered'))).toBe('log_in');
  });

  it('asks for a new passkey only when the server never received one', () => {
    expect(getAccountCreationRecovery(apiError(400, 'Passkey data is required'))).toBe(
      'new_passkey',
    );
  });

  it('retries with the same passkey otherwise', () => {
    for (const error of [
      new TypeError('Failed to fetch'),
      new TypeError('Load failed'),
      new TypeError('Network request failed'),
      apiError(429, 'ThrottlerException: Too Many Requests'),
      apiError(400, 'Failed to create account'),
      apiError(502, 'Bad Gateway'),
      // The client's own wallet setup, after the account exists.
      Object.assign(new Error('HTTP request failed.'), {
        name: 'HttpRequestError',
        version: 'viem@2.47.10',
      }),
      undefined,
    ]) {
      expect(getAccountCreationRecovery(error)).toBe('retry');
    }
  });
});

describe('isRateLimitedError', () => {
  it('recognises the throttler by status or by its message', () => {
    expect(isRateLimitedError(apiError(429, 'ThrottlerException: Too Many Requests'))).toBe(true);
    expect(isRateLimitedError(new Error('ThrottlerException: Too Many Requests'))).toBe(true);
    expect(isRateLimitedError(apiError(400, 'Failed to create account'))).toBe(false);
  });
});

describe('getAccountCreationStatus', () => {
  it('reads either status field', () => {
    expect(getAccountCreationStatus(apiError(401, 'x'))).toBe(401);
    expect(getAccountCreationStatus({ statusCode: 503 })).toBe(503);
    expect(getAccountCreationStatus(new Error('x'))).toBeUndefined();
  });
});

describe('getAccountCreationSeverity', () => {
  const severityOf = (error: unknown) =>
    getAccountCreationSeverity(error, getAccountCreationRecovery(error));

  it('files the server enforcing its rules as info', () => {
    expect(severityOf(apiError(409, 'This username is already taken'))).toBe('info');
    expect(severityOf(apiError(409, 'Email already registered'))).toBe('info');
  });

  it('files an expired verification, the rate limit and a dropped connection as warnings', () => {
    expect(severityOf(apiError(401, 'Invalid or expired verification token'))).toBe('warning');
    expect(severityOf(apiError(429, 'ThrottlerException: Too Many Requests'))).toBe('warning');
    expect(severityOf(new TypeError('Failed to fetch'))).toBe('warning');
    // Safari's wording, under viem's wrapper: the wallet step after signup.
    expect(
      severityOf(
        Object.assign(new Error('HTTP request failed.'), {
          name: 'HttpRequestError',
          details: 'Load failed',
          version: 'viem@2.47.10',
        }),
      ),
    ).toBe('warning');
  });

  it('keeps what the app or server could be at fault for as an error', () => {
    expect(severityOf(apiError(400, 'Passkey data is required'))).toBe('error');
    expect(severityOf(apiError(502, 'Bad Gateway'))).toBe('error');
    expect(severityOf(apiError(400, 'Failed to create account'))).toBe('error');
    expect(severityOf(undefined)).toBe('error');
  });
});
