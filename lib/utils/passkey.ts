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
