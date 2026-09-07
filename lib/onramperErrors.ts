/**
 * Client side of Onramper failure reporting.
 *
 * The SDK throws `OnramperError` — an Error carrying a machine-readable `code`
 * (`attestationFailed`, `quoteUnavailable`, `deviceBlocked`…) and sometimes an
 * `info` bag. That detail is the whole diagnosis, and the screens only have room
 * for a sentence, so it is pulled out here for logs and for a dev-build readout.
 *
 * Deliberately duck-typed rather than importing the SDK's `OnramperError`: this
 * module is imported from the shared UI, and the package is iOS-only (metro
 * stubs it out of the web bundle entirely).
 */

/**
 * A session mint that came back non-OK.
 *
 * `lib/api` throws the raw `Response` for most endpoints, which reaches an error
 * boundary as "[object Response]" and says nothing about what failed. Onramper's
 * bootstrap is the one place that is actively harmful — a failed mint is
 * indistinguishable from a failed native init in the UI — so it gets a real
 * Error. `status` is kept because `isHTTPError` duck-types on it, and dropping
 * it would stop `withRefreshToken` retrying an expired JWT.
 */
export class OnramperSessionError extends Error {
  readonly status: number;
  readonly body?: string;

  constructor(status: number, body?: string) {
    super(`Onramper session request failed with ${status}${body ? `: ${body.slice(0, 300)}` : ''}`);
    this.name = 'OnramperSessionError';
    this.status = status;
    this.body = body;
  }
}

/** The SDK's error code, when the value carries one. */
export const getOnramperErrorCode = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown })?.code;

  return typeof code === 'string' ? code : undefined;
};

/**
 * One line naming what failed, for a log or a dev-build readout.
 *
 * Leads with the code, because that is the part that maps to a cause — the
 * message is often just "Failed to initialize".
 */
export const describeOnramperError = (error: unknown): string => {
  if (error == null) return 'unknown error';

  const code = getOnramperErrorCode(error);
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);

  const info = (error as { info?: unknown })?.info;
  const extra =
    info && typeof info === 'object' && Object.keys(info).length > 0
      ? ` ${safeStringify(info)}`
      : '';

  return `${code ? `[${code}] ` : ''}${message}${extra}`;
};

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return '[uninspectable]';
  }
};
