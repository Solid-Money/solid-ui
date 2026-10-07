/**
 * Turning a thrown error into text that is safe to put in front of a person.
 *
 * The app talks to bundlers, paymasters and RPC nodes directly, and viem builds
 * its error messages for developers: the failing URL, the full request body and
 * the upstream reply. On Sep 30 a card activation that hit an empty Pimlico
 * sponsorship balance printed exactly that into a toast — including
 * `?apikey=pim_…` from the RPC URL and our negative sponsorship balance — and the
 * customer pasted it into a support chat. `error.message` from anything below
 * our own copy is never a sentence for the user; it is evidence for Sentry.
 *
 * Kept free of viem and React imports so the toast renderer and Sentry's
 * `beforeSend` can use it without pulling either in.
 */

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Our paymaster refused to sponsor the operation — today that means the
 * sponsorship balance ran out. Nothing was sent on-chain, and it is ours to fix,
 * so the copy says both rather than suggesting the user did something wrong.
 */
export const NETWORK_FEE_UNAVAILABLE_MESSAGE =
  'We could not cover the network fee right now. Nothing was charged — please try again in a few minutes.';

export const NETWORK_UNREACHABLE_MESSAGE =
  'We could not reach the network. Check your connection and try again.';

export const USER_CANCELLED_MESSAGE = 'Request cancelled.';

const REDACTED = '[redacted]';

/**
 * Credentials that ride along in URLs and headers. Pimlico keys sit in the
 * query string (`?apikey=pim_…`), so the URL alone is enough to leak one.
 */
const SECRET_PATTERNS: [RegExp, string][] = [
  [
    /\b(api[_-]?key|apikey|access[_-]?token|auth[_-]?token|token|secret|key)=([^&\s"'<>]+)/gi,
    `$1=${REDACTED}`,
  ],
  [/\bpim_[A-Za-z0-9]{6,}/g, REDACTED],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`],
];

/** Strip credentials from free text. Leaves everything else as it was. */
export const redactSecrets = (text: string): string =>
  SECRET_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);

/**
 * Signs that a string was written for a developer, not a user: viem's
 * `URL: / Request body: / Details: / Version:` layout, raw URLs, JSON, long hex
 * blobs, JS runtime errors and stack frames.
 */
const TECHNICAL_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /\b(api[_-]?key|apikey)\b/i,
  /\bpim_[A-Za-z0-9]/,
  /\b(request body|raw call arguments|contract call|docs):/i,
  /\bdetails:/i,
  /\bversion:\s*\S+@\d/i,
  /\bviem@\d/i,
  /0x[0-9a-fA-F]{64,}/,
  /[{[]\s*"[^"]+"\s*:/,
  /\n\s+at\s+\S+/,
  /\b(TypeError|ReferenceError|SyntaxError|RangeError):/,
  /\b(undefined|null) is not (an object|a function)/i,
  /\bcannot read propert(y|ies) of\b/i,
  /\bis not a function\b/i,
  /\b(pm|eth|pimlico)_[a-zA-Z]+\b/,
];

/** Past this a message is a dump, not a sentence, whatever it contains. */
const MAX_USER_MESSAGE_LENGTH = 240;

/** Whether `text` looks like a raw technical error rather than copy for a user. */
export const isTechnicalErrorText = (text: string): boolean =>
  text.length > MAX_USER_MESSAGE_LENGTH || TECHNICAL_PATTERNS.some(pattern => pattern.test(text));

/**
 * Text that is safe to render: credentials removed, and anything that still
 * reads as a developer dump replaced by `fallback`. The last line of defence for
 * surfaces that take arbitrary strings, such as the toast renderer.
 */
export const sanitizeDisplayText = (text: string, fallback = GENERIC_ERROR_MESSAGE): string => {
  const redacted = redactSecrets(text);
  return isTechnicalErrorText(redacted) ? fallback : redacted;
};

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  shortMessage?: unknown;
  details?: unknown;
  version?: unknown;
  cause?: unknown;
};

/** Every message in the error and its cause chain, for classification only. */
const collectErrorText = (error: unknown, depth = 0): string => {
  if (error == null || depth > 5) return '';
  if (typeof error === 'string') return error;
  if (typeof error !== 'object') return String(error);

  const err = error as ErrorLike;
  const parts = [err.name, err.message, err.shortMessage, err.details].filter(
    (part): part is string => typeof part === 'string',
  );
  return [...parts, collectErrorText(err.cause, depth + 1)].join('\n');
};

/** viem's BaseError carries `version: 'viem@x.y.z'`; nothing it writes is user copy. */
const isViemError = (error: unknown): boolean => {
  const version = (error as ErrorLike | null)?.version;
  return typeof version === 'string' && version.startsWith('viem@');
};

const isCancellation = (text: string): boolean =>
  /\bNotAllowedError\b|user (rejected|denied|cancell?ed)|rejected by user|aborted by the user|operation either timed out or was not allowed/i.test(
    text,
  );

/**
 * Matched on phrases, not on the word "paymaster": viem's message embeds the
 * request body, and every sponsored user operation carries a `paymaster` field
 * there whatever actually went wrong. `pm_getPaymaster*Data` only appears when
 * that call is the one that failed, and AA3x are the EntryPoint's paymaster codes.
 */
const isSponsorshipFailure = (text: string): boolean =>
  /insufficient pimlico balance|for sponsorship|sponsorship (policy|balance)|pm_getPaymaster(Stub)?Data|pm_sponsorUserOperation|\bAA3\d\b/i.test(
    text,
  );

// `Load failed` is Safari's wording for what Chrome calls `Failed to fetch`.
const isNetworkFailure = (text: string): boolean =>
  /network request failed|failed to fetch|\bload failed\b|\bnetworkerror\b|request timed out|took too long to respond/i.test(
    text,
  );

/** Whether the connection failed, rather than anything at the other end. */
export const isNetworkError = (error: unknown): boolean =>
  isNetworkFailure(collectErrorText(error));

/**
 * The sentence to show for a failure, never the raw `error.message` of a
 * dependency.
 *
 * Recognised failures — a dismissed passkey prompt, a paymaster that would not
 * sponsor, an unreachable network — get our own copy. Messages our own code or
 * backend wrote for people (`new Error('Insufficient balance')`, an `ApiError`
 * carrying the server's message) pass through once they are confirmed not to be
 * a dump. Everything else becomes `fallback`, which callers should make specific
 * to what failed ("Withdrawal failed. Please try again.").
 */
export const userFacingErrorMessage = (
  error: unknown,
  fallback: string = GENERIC_ERROR_MESSAGE,
): string => {
  const text = collectErrorText(error);

  if (isCancellation(text)) return USER_CANCELLED_MESSAGE;
  if (isSponsorshipFailure(text)) return NETWORK_FEE_UNAVAILABLE_MESSAGE;
  if (isNetworkFailure(text)) return NETWORK_UNREACHABLE_MESSAGE;

  if (isViemError(error)) return fallback;

  const message =
    typeof error === 'string'
      ? error
      : typeof (error as ErrorLike | null)?.message === 'string'
        ? ((error as ErrorLike).message as string)
        : '';
  const trimmed = message.trim();
  if (!trimmed) return fallback;

  return sanitizeDisplayText(trimmed, fallback);
};

/**
 * Credentials scrubbed out of an arbitrary value — strings anywhere inside
 * objects and arrays — for telemetry payloads such as Sentry events, where the
 * raw viem message (and the API key in its URL) otherwise lands verbatim.
 */
export const redactSecretsDeep = <T>(value: T, depth = 0): T => {
  if (depth > 8 || value == null) return value;
  if (typeof value === 'string') return redactSecrets(value) as T;
  if (Array.isArray(value)) return value.map(item => redactSecretsDeep(item, depth + 1)) as T;
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactSecretsDeep(item, depth + 1);
    }
    return out as T;
  }
  return value;
};
