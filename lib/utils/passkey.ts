/**
 * Passkey/WebAuthn helpers.
 *
 * Deliberately free of app imports: these are pure and are exercised directly
 * by unit tests, which the rest of `lib/utils` cannot be (it reaches AsyncStorage
 * and the API client at module load).
 */

/**
 * Decode a stored credential id, or `undefined` if it is not valid base64url.
 *
 * These values are persisted on the device and replayed into `allowCredentials`
 * during render, so a single corrupt entry must not be able to throw the
 * TurnkeyProvider tree — skipping it costs at most one credential in the filter.
 */
export const tryBase64urlToUint8Array = (base64url: string): Uint8Array | undefined => {
  try {
    return base64urlToUint8Array(base64url);
  } catch {
    return undefined;
  }
};

export const base64urlToUint8Array = (base64url: string): Uint8Array => {
  // Convert base64url to base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padLen = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(padLen);

  // Decode base64 to binary string
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Pull the WebAuthn credential id out of a Turnkey passkey stamp header. The
 * stamp is a JSON envelope (`{ authenticatorData, clientDataJson,
 * credentialId, signature }`) — API-key stamps carry no credentialId, so
 * anything unparseable or missing is simply "not a passkey stamp".
 */
export const parseStampHeaderValueCredentialId = (stampHeaderValue: string): string | undefined => {
  try {
    const parsed = JSON.parse(stampHeaderValue) as { credentialId?: unknown };
    return typeof parsed.credentialId === 'string' && parsed.credentialId
      ? parsed.credentialId
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The credentials to remember for an account once a passkey has signed for it.
 *
 * Adds rather than replaces: a stamp proves one credential exists, and says
 * nothing about the others the account holds. Dropping them would pin
 * `allowCredentials` to a set that excludes whichever passkey the user's other
 * device has.
 */
export const mergeCredentialIds = (
  known: string[] | undefined,
  primary: string | undefined,
  stamped: string | undefined,
): string[] => {
  const merged = known?.length ? [...known] : primary ? [primary] : [];
  if (stamped && !merged.includes(stamped)) merged.push(stamped);
  return merged;
};

/**
 * Turnkey's own validation for an authenticator name, mirrored here so a name
 * this app builds can be checked before it reaches the SDK.
 *
 * See `isValidPasskeyName` in @turnkey/core: React Native is capped at 64
 * characters, and both platforms allow only these ASCII characters.
 */
const TURNKEY_PASSKEY_NAME_PATTERN = /^[a-zA-Z0-9 _\-:/.]{1,64}$/;

export const isValidTurnkeyPasskeyName = (name: string): boolean =>
  TURNKEY_PASSKEY_NAME_PATTERN.test(name);

/**
 * Name for the passkey that a recovery adds to the account.
 *
 * Turnkey requires the name to match {@link TURNKEY_PASSKEY_NAME_PATTERN} and
 * treats names as unique per resource, so it has to be ASCII *and* different on
 * every attempt. A locale-formatted date satisfied neither:
 *
 * - `toLocaleDateString()` follows the device locale, so on an Arabic, Persian
 *   or Bengali device it returns non-Latin digits and embedded RTL marks
 *   (`ar-EG` gives `٧‏/٩‏/٢٠٢٦`). Those fail the pattern, and the SDK rejects
 *   the name before it ever shows the passkey prompt.
 * - Its granularity is one day, so a second attempt on the same date re-sent a
 *   name the account already had, which Turnkey refuses.
 *
 * An ISO timestamp is ASCII by construction, passes the pattern as-is, and is
 * unique per millisecond — the same approach the SDK takes when no name is
 * given (`Turnkey Passkey-${Date.now()}`).
 */
export const buildRecoveryPasskeyName = (now: Date = new Date()): string =>
  `Recovery Passkey - ${now.toISOString()}`;

/**
 * Turnkey error codes that mean "this session can no longer act", as opposed to
 * a failure of the passkey prompt or of the activity itself.
 */
const TURNKEY_SESSION_ERROR_CODES = ['SESSION_EXPIRED', 'NO_SESSION_FOUND'];

/**
 * Message fragments Turnkey returns for a lapsed session. The SDK only
 * translates two exact strings into `SESSION_EXPIRED`, so anything else arrives
 * wrapped in the calling method's generic message (for `addPasskey`, a bare
 * "Failed to add passkey") and has to be recognised from the text.
 */
const TURNKEY_SESSION_ERROR_PATTERNS = [
  /session (?:has )?expired/i,
  /expired api key/i,
  /could not find public key/i,
  /no active session/i,
  /unauthenticated/i,
];

/**
 * Whether a failure means the Turnkey session is gone rather than that the
 * passkey step itself failed.
 *
 * This is the difference between a retry that can work and one that cannot: a
 * recovery session is minted from a single-use code, so once it lapses no
 * number of retries on the same screen will succeed — the user needs a new
 * code. Errors are inspected recursively because the SDK wraps the underlying
 * failure in its own `TurnkeyError` and only exposes it via `cause`.
 */
export const isTurnkeySessionError = (error: unknown, depth = 0): boolean => {
  const err = error as { code?: unknown; message?: unknown; cause?: unknown } | null;
  if (!err || depth > 4) return false;

  if (typeof err.code === 'string' && TURNKEY_SESSION_ERROR_CODES.includes(err.code)) {
    return true;
  }

  if (
    typeof err.message === 'string' &&
    TURNKEY_SESSION_ERROR_PATTERNS.some(pattern => pattern.test(err.message as string))
  ) {
    return true;
  }

  return isTurnkeySessionError(err.cause, depth + 1);
};

/** WebAuthn / Credential Manager DOMException names raised by a failed prompt. */
const PASSKEY_ERROR_NAMES = ['NotAllowedError', 'AbortError', 'InvalidStateError'];

/**
 * Message shapes seen in the wild for the same failure — Android Credential
 * Manager (`[16] Cancelled by user.`), iOS (`The user cancelled the request.`)
 * and Turnkey's own wrapping of both.
 */
const PASSKEY_ERROR_PATTERNS = [
  /cancell?ed/i,
  /no (?:passkeys?|credentials?)\b/i,
  /credential[_\s-]?not[_\s-]?found/i,
  /NoCredentialException/i,
  /PASSKEY|WEBAUTHN/i,
];

/**
 * Whether a failure came from the passkey prompt itself rather than from
 * anything downstream of it.
 *
 * WebAuthn deliberately reports "you cancelled" and "this authenticator holds
 * none of the credentials you asked for" identically, so this cannot tell them
 * apart — and does not try to. Callers use it to drop a credential filter that
 * *might* be the reason the prompt failed: an unnecessary drop only costs an
 * unfiltered prompt on the retry, while keeping a bad filter is a dead end.
 */
export const isPasskeyPromptError = (error: unknown): boolean => {
  const err = error as { name?: unknown; message?: unknown; code?: unknown } | null;
  if (!err) return false;

  if (typeof err.name === 'string' && PASSKEY_ERROR_NAMES.includes(err.name)) return true;

  const haystack = [err.message, err.code].filter(part => typeof part === 'string').join(' ');
  return PASSKEY_ERROR_PATTERNS.some(pattern => pattern.test(haystack));
};
