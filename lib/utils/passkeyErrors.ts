/**
 * What actually went wrong when a passkey could not be created.
 *
 * Turnkey wraps whatever WebAuthn or the native passkey module threw, once on
 * web and twice on native, and the wrapper's message is all that reached
 * analytics: "Failed to create passkey" for nearly everything, or "Passkey
 * creation was cancelled by the user." whenever Chrome's NotAllowedError text
 * matched. The signup screen also tested `err.name === 'NotAllowedError'`,
 * which is never true of the wrapper (`TurnkeyError`), so a person who
 * dismissed the prompt was told setup had failed.
 *
 * The real reason sits at the bottom of the `cause` chain:
 *
 * - web: a DOMException, e.g. `NotAllowedError`, `NotReadableError` (Chrome on
 *   Android when Google Password Manager is unusable), `NotSupportedError`, or
 *   a plain `Error('webauthn is not supported by this browser')`;
 * - native: react-native-passkey's plain object, e.g.
 *   `{ error: 'UserCancelled', message: 'The user cancelled the request.' }`,
 *   or Credential Manager text such as `[16] Cancelled by user.`.
 *
 * Free of app imports so it can be unit-tested directly.
 */

export type PasskeyFailureKind =
  /** The person dismissed the passkey prompt. */
  | 'cancelled'
  /**
   * `NotAllowedError` after the prompt had time to show: a cancel, a timeout or
   * a refusal. WebAuthn reports all three alike on purpose, for privacy.
   */
  | 'not_allowed'
  /** Refused before any prompt could have shown, so nobody cancelled it. */
  | 'blocked'
  /** No passkey support on this browser or device at all. */
  | 'unsupported'
  /** The device's passkey store failed: no screen lock, password manager off or broken. */
  | 'device_setup'
  | 'unknown';

/** Sentry's level for a failure: a subset of `SeverityLevel`. */
export type PasskeyErrorSeverity = 'error' | 'warning' | 'info';

export type PasskeyErrorDetails = {
  kind: PasskeyFailureKind;
  /** How loudly to report it. See `severityOf`. */
  severity: PasskeyErrorSeverity;
  /** Turnkey's error code, e.g. `CREATE_PASSKEY_ERROR`. */
  code?: string;
  /** The innermost error's name, e.g. `NotAllowedError`, or the native module's `error`. */
  causeName?: string;
  /** The innermost error's message. */
  causeMessage?: string;
};

/**
 * A `NotAllowedError` this fast was never a person: the passkey sheet takes
 * longer than this to appear, let alone be dismissed. WKWebView in apps without
 * passkey rights refuses in a few milliseconds, and Amplitude has sessions
 * failing nine times in two seconds.
 */
export const INSTANT_REFUSAL_MS = 1000;

const MAX_DEPTH = 6;
const MAX_MESSAGE_LENGTH = 300;

type ErrorNode = {
  name?: string;
  message?: string;
  code?: string;
  /** react-native-passkey's code: `UserCancelled`, `NotSupported`, ... */
  error?: string;
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/** The error and every `cause` beneath it, outermost first. */
const errorChain = (error: unknown): ErrorNode[] => {
  const nodes: ErrorNode[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current != null && nodes.length < MAX_DEPTH && !seen.has(current)) {
    seen.add(current);
    if (typeof current === 'string') {
      nodes.push({ message: current });
      break;
    }
    if (typeof current !== 'object') break;
    const candidate = current as Record<string, unknown>;
    nodes.push({
      name: asString(candidate.name),
      message: asString(candidate.message),
      code: asString(candidate.code),
      error: asString(candidate.error),
    });
    current = candidate.cause;
  }
  return nodes;
};

/**
 * react-native-passkey and Credential Manager wording for a dismissed prompt,
 * and the transaction hooks' own `User cancelled transaction`.
 */
const NATIVE_CANCEL_PATTERNS = [
  /\bUserCancelled\b/,
  /\bcancell?ed by (the )?user\b/i,
  /\buser cancell?ed\b/i,
  /\bThe user cancell?ed the request\b/i,
];

const UNSUPPORTED_PATTERNS = [
  /webauthn is not supported/i,
  /does not support public key credentials/i,
  /passkeys are not supported/i,
];

/**
 * Credential Manager / Google Play services failures. `folsom` is the Play
 * services component behind passkeys on Android.
 */
const DEVICE_SETUP_PATTERNS = [
  /folsom/i,
  /credential manager/i,
  /password manager/i,
  /screen lock/i,
  /no create options available/i,
  // Play services after the person consented: "Get Key Material failed after Record Consent."
  /key material/i,
  /\bNotConfigured\b/,
  /\bNoCredentials\b/,
];

const DEVICE_SETUP_NAMES = ['NotReadableError', 'UnknownError', 'OperationError'];
const DEVICE_SETUP_NATIVE_CODES = [
  'NotConfigured',
  'NoCredentials',
  'RequestFailed',
  'UnknownError',
];

/**
 * Whether `error` says the person dismissed the prompt.
 *
 * Not a `NotAllowedError`: Turnkey rewrites Chrome's into "cancelled by the
 * user" whatever happened, so that wording is no evidence of a cancel there.
 */
export const isCancelledByUser = (error: unknown): boolean => {
  const chain = errorChain(error);
  if (chain.some(node => node.name === 'NotAllowedError')) return false;
  const text = chain.map(node => node.message ?? '').join('\n');
  return (
    chain.some(node => node.error === 'UserCancelled') ||
    NATIVE_CANCEL_PATTERNS.some(pattern => pattern.test(text))
  );
};

/**
 * How loudly Sentry should hear about a failed passkey prompt.
 *
 * Only what could be the app's own fault is an `error`. Before this, every
 * failure was one: Sentry filed dismissed login and signup prompts as errors,
 * beside in-app browsers and phones without a working password manager.
 */
const severityOf = (kind: PasskeyFailureKind, names: string[]): PasskeyErrorSeverity => {
  switch (kind) {
    // The person's choice, or what WebAuthn will not tell apart from it.
    case 'cancelled':
    case 'not_allowed':
      return 'info';
    // Every passkey route is a secure, top-level page, which leaves a
    // SecurityError one cause: a relying party ID that does not match the
    // origin, i.e. our configuration. An instant refusal is the browser's.
    case 'blocked':
      return names.includes('SecurityError') ? 'error' : 'warning';
    // The browser or phone, which the person can change and the app cannot.
    case 'unsupported':
    case 'device_setup':
      return 'warning';
    default:
      return 'error';
  }
};

export const getPasskeyErrorDetails = (
  error: unknown,
  { elapsedMs }: { elapsedMs?: number } = {},
): PasskeyErrorDetails => {
  const chain = errorChain(error);
  const root = chain.length > 1 ? chain[chain.length - 1] : undefined;
  const names = chain.map(node => node.name).filter(Boolean) as string[];
  const nativeCodes = chain.map(node => node.error).filter(Boolean) as string[];
  const text = chain.map(node => node.message ?? '').join('\n');

  // The SDK's own code, preferring a specific one over the wrapper's UNKNOWN.
  const codes = chain.map(node => node.code).filter(Boolean) as string[];
  const code = codes.find(candidate => candidate !== 'UNKNOWN') ?? codes[0];

  const kind = ((): PasskeyFailureKind => {
    // Checked before any message: Turnkey rewrites Chrome's NotAllowedError
    // text into "cancelled by the user", which is not evidence of a cancel.
    if (names.includes('NotAllowedError')) {
      return elapsedMs !== undefined && elapsedMs < INSTANT_REFUSAL_MS ? 'blocked' : 'not_allowed';
    }
    if (names.includes('AbortError')) return 'cancelled';
    if (names.includes('SecurityError')) return 'blocked';
    if (
      names.includes('NotSupportedError') ||
      nativeCodes.includes('NotSupported') ||
      UNSUPPORTED_PATTERNS.some(pattern => pattern.test(text))
    ) {
      return 'unsupported';
    }
    if (isCancelledByUser(error)) return 'cancelled';
    // Ran out of time, or Credential Manager was interrupted, which Android
    // documents as worth retrying: it did not finish, and another tap may.
    if (
      nativeCodes.includes('TimedOut') ||
      nativeCodes.includes('Interrupted') ||
      names.includes('TimeoutError')
    ) {
      return 'not_allowed';
    }
    if (
      names.some(name => DEVICE_SETUP_NAMES.includes(name)) ||
      nativeCodes.some(nativeCode => DEVICE_SETUP_NATIVE_CODES.includes(nativeCode)) ||
      DEVICE_SETUP_PATTERNS.some(pattern => pattern.test(text))
    ) {
      return 'device_setup';
    }
    return 'unknown';
  })();

  return {
    kind,
    severity: severityOf(kind, names),
    code,
    causeName: root?.name ?? root?.error,
    causeMessage: root?.message?.slice(0, MAX_MESSAGE_LENGTH),
  };
};
