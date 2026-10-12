import { onlineManager } from '@tanstack/react-query';

import { ERROR_ACTIONS, ErrorAction } from '@/lib/errors/actions';
import { clampText, ERROR_COPY_LIMITS } from '@/lib/errors/copyLimits';
import { isHex32 } from '@/lib/errors/errorRef';
import { sanitizeTechnicalMessage } from '@/lib/errors/sanitize';

/** The family a failure belongs to; decides the copy and whether we report it. */
export type ErrorKind =
  | 'cancelled'
  | 'offline'
  | 'timeout'
  | 'session'
  | 'rate_limited'
  | 'insufficient_funds'
  | 'rejected'
  | 'blockchain'
  | 'server'
  | 'unknown';

/** Where a failure is shown. */
export type ErrorSurface = 'sheet' | 'toast' | 'inline' | 'screen';

/** What we know about a thrown value, whatever shape it came in. */
export interface NormalizedError {
  original: unknown;
  name?: string;
  /** Raw technical text. Internal only: may hold URLs, keys and calldata. */
  message: string;
  status?: number;
  /** A backend `code` (`KYC_REQUIRED`) or an SDK code. */
  code?: string;
  /** The failing request's `X-Request-Id`, when it was one of ours. */
  requestId?: string;
  /** The backend's own message, a candidate for user copy once vetted. */
  serverMessage?: string;
  /** Request path, no query string, for telemetry. */
  path?: string;
}

export interface ErrorDetails {
  /** As the user typed it, e.g. `50`. */
  amount?: string;
  token?: string;
  network?: string;
}

export interface ErrorContext {
  action?: ErrorAction;
  /** Replaces the action's title. Keep it to what failed, ≤ 40 characters. */
  title?: string;
  /** Replaces the derived body. Never raw error text. */
  body?: string;
  details?: ErrorDetails;
  /** Extra GlitchTip tags for this failure, e.g. `{ type: 'direct_deposit_session_error' }`. */
  tags?: Record<string, string>;
}

/** A failure, translated for the person holding the phone. */
export interface UserError {
  action: ErrorAction;
  kind: ErrorKind;
  /** Stable code for support and dashboards, e.g. `PAYMASTER_REJECTED`, `HTTP_502`. */
  code: string;
  title: string;
  body: string;
  /** The user backed out (passkey prompt, wallet rejection): show nothing. */
  silent: boolean;
  /** True only when we know no transaction left the device. */
  nothingSent?: boolean;
  status?: number;
  requestId?: string;
  /** Sanitized technical cause, for telemetry. */
  technical: string;
}

/** User copy that some error classes already carry (vetted, written for users). */
const USER_COPY_ERROR_NAMES = new Set(['TransfiError', 'OrchestraError']);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

const asStatus = (value: unknown): number | undefined =>
  typeof value === 'number' && value >= 100 && value < 600 ? value : undefined;

const readBodyMessage = (body: Record<string, unknown> | undefined): string | undefined => {
  if (!body) return undefined;
  const message = body.message;
  if (Array.isArray(message)) return message.filter(m => typeof m === 'string').join(', ');
  return asString(message) ?? asString(asRecord(body.error)?.message);
};

const readRequestId = (value: unknown): string | undefined => {
  const id = asString(value)?.trim().toLowerCase();
  return isHex32(id) ? id : undefined;
};

const pathOf = (url: unknown): string | undefined => {
  const value = asString(url);
  if (!value) return undefined;
  try {
    return new URL(value, 'https://x.invalid').pathname;
  } catch {
    return value.split('?')[0];
  }
};

/** Every message in the error's `cause` chain, which is where viem and Turnkey put the real one. */
const causeChain = (error: unknown): string[] => {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    const record = asRecord(current);
    if (!record) {
      if (typeof current === 'string') parts.push(current);
      break;
    }
    for (const key of ['name', 'shortMessage', 'message', 'details', 'code']) {
      const value = record[key];
      if (typeof value === 'string' || typeof value === 'number') parts.push(String(value));
    }
    current = record.cause;
  }
  return parts;
};

const isResponse = (value: unknown): value is Response =>
  typeof Response !== 'undefined' && value instanceof Response;

/**
 * Read a thrown value into one shape, synchronously.
 *
 * Handles what this codebase actually throws: a raw `Response` (147 call sites
 * in `lib/api.ts` do `throw response`), `ApiError` / `TransfiError` /
 * `OrchestraError`, axios errors, viem and Turnkey errors, plain `Error`s and
 * strings. A `Response` body can only be read asynchronously; see
 * {@link normalizeErrorAsync}.
 */
export const normalizeError = (error: unknown): NormalizedError => {
  if (isResponse(error)) {
    return {
      original: error,
      name: 'HTTPResponse',
      message: `HTTP ${error.status} ${error.statusText ?? ''}`.trim(),
      status: asStatus(error.status),
      requestId: readRequestId(error.headers?.get?.('x-request-id')),
      path: pathOf(error.url),
    };
  }

  if (typeof error === 'string') return { original: error, message: error };

  const record = asRecord(error);
  if (!record) return { original: error, message: String(error ?? '') };

  // axios: the server's answer lives on `response`.
  const response = asRecord(record.response);
  const responseData = asRecord(response?.data);
  const responseHeaders = asRecord(response?.headers);
  const config = asRecord(record.config);

  const name = asString(record.name);
  const status =
    asStatus(record.status) ?? asStatus(record.statusCode) ?? asStatus(response?.status);
  const code =
    asString(record.code) ??
    asString(responseData?.code) ??
    asString(asRecord(responseData?.error)?.code);
  const serverMessage = response
    ? readBodyMessage(responseData)
    : status !== undefined
      ? asString(record.message)
      : undefined;

  return {
    original: error,
    name,
    message: causeChain(error).join(' '),
    status,
    code,
    requestId:
      readRequestId(record.requestId) ??
      readRequestId(responseData?.requestId) ??
      readRequestId(responseHeaders?.['x-request-id']),
    serverMessage,
    path: pathOf(config?.url),
  };
};

/**
 * {@link normalizeError}, plus the body of a thrown `Response` (its `message`,
 * `code` and `requestId`), when nobody has read it yet.
 */
export const normalizeErrorAsync = async (error: unknown): Promise<NormalizedError> => {
  const normalized = normalizeError(error);
  if (!isResponse(error) || error.bodyUsed) return normalized;
  try {
    const body = asRecord(await error.clone().json());
    return {
      ...normalized,
      code: normalized.code ?? asString(body?.code) ?? asString(asRecord(body?.error)?.code),
      requestId: normalized.requestId ?? readRequestId(body?.requestId),
      serverMessage: readBodyMessage(body),
    };
  } catch {
    return normalized;
  }
};

const CANCELLED_NAMES = new Set(['NotAllowedError', 'AbortError', 'UserRejectedRequestError']);
const CANCELLED =
  /\buser (?:cancell?ed|rejected|denied)|cancell?ed by (?:the )?user|operation either timed out or was not allowed|aborted by the user|\[16\] cancell?ed|CancellationException|activity is cancell?ed/i;
const OFFLINE =
  /network request failed|failed to fetch|networkerror|network error|load failed|internet connection appears to be offline|ERR_NETWORK|ERR_INTERNET_DISCONNECTED/i;
const TIMEOUT_NAMES = new Set(['TimeoutError', 'FetchTimeoutError']);
const TIMEOUT = /timed? ?out|timeout/i;
const RECEIPT_WAIT =
  /waitfortransactionreceipt|waitforuseroperationreceipt|waiting for (?:the )?(?:transaction|user ?operation)|transaction receipt/i;
const RATE_LIMITED = /too many requests|throttlerexception|rate.?limit/i;
const INSUFFICIENT_FUNDS =
  /insufficient (?:funds|balance)|exceeds balance|transfer amount exceeds|not enough (?:balance|funds)/i;
const BLOCKCHAIN =
  /paymaster|pm_(?:get|sponsor)|bundler|user ?operation|\bAA[1-5]\d\b|eth_\w+|execution reverted|reverted|simulat|\brpc\b|\bgas\b|nonce|contract ?function|replacement transaction|intrinsic/i;

interface Classification {
  kind: ErrorKind;
  code: string;
  nothingSent?: boolean;
}

/** Sort a failure into a family and a stable code. Order matters: first match wins. */
export const classifyError = (n: NormalizedError): Classification => {
  const haystack = `${n.name ?? ''} ${n.message} ${n.code ?? ''}`;
  const record = asRecord(n.original);

  if (
    (n.name && CANCELLED_NAMES.has(n.name)) ||
    record?.code === 4001 ||
    CANCELLED.test(haystack)
  ) {
    return { kind: 'cancelled', code: 'USER_CANCELLED' };
  }
  if (n.status === undefined && (!onlineManager.isOnline() || OFFLINE.test(haystack))) {
    return { kind: 'offline', code: 'NETWORK_OFFLINE', nothingSent: undefined };
  }
  if (RECEIPT_WAIT.test(haystack)) {
    // The transaction went out; we just stopped waiting for it.
    return { kind: 'timeout', code: 'RECEIPT_TIMEOUT', nothingSent: false };
  }
  if (
    (n.name && TIMEOUT_NAMES.has(n.name)) ||
    n.status === 408 ||
    n.status === 504 ||
    (n.status === undefined && TIMEOUT.test(haystack))
  ) {
    return { kind: 'timeout', code: n.status ? `HTTP_${n.status}` : 'REQUEST_TIMEOUT' };
  }
  if (n.status === 401) return { kind: 'session', code: 'HTTP_401' };
  if (n.status === 429 || RATE_LIMITED.test(haystack)) {
    return { kind: 'rate_limited', code: 'RATE_LIMITED' };
  }
  if (INSUFFICIENT_FUNDS.test(haystack)) {
    return { kind: 'insufficient_funds', code: 'INSUFFICIENT_FUNDS', nothingSent: true };
  }
  if (n.status !== undefined && n.status >= 400 && n.status < 500) {
    return { kind: 'rejected', code: n.code ?? `HTTP_${n.status}` };
  }
  if (n.status !== undefined && n.status >= 500) {
    return { kind: 'server', code: `HTTP_${n.status}` };
  }
  if (BLOCKCHAIN.test(haystack)) {
    const aa = haystack.match(/\bAA[1-5]\d\b/)?.[0];
    if (/paymaster|pm_(?:get|sponsor)/i.test(haystack)) {
      return { kind: 'blockchain', code: 'PAYMASTER_REJECTED', nothingSent: true };
    }
    if (aa) return { kind: 'blockchain', code: `USEROP_${aa}`, nothingSent: true };
    if (/simulat/i.test(haystack)) {
      return { kind: 'blockchain', code: 'SIMULATION_REVERTED', nothingSent: true };
    }
    if (/execution reverted/i.test(haystack)) {
      return { kind: 'blockchain', code: 'EXECUTION_REVERTED', nothingSent: true };
    }
    if (/reverted/i.test(haystack)) return { kind: 'blockchain', code: 'TX_REVERTED' };
    if (/bundler|eth_sendUserOperation|eth_estimateUserOperationGas/i.test(haystack)) {
      return { kind: 'blockchain', code: 'BUNDLER_REJECTED', nothingSent: true };
    }
    return { kind: 'blockchain', code: 'RPC_ERROR', nothingSent: true };
  }
  return { kind: 'unknown', code: n.code && /^[A-Z0-9_]{3,40}$/.test(n.code) ? n.code : 'UNKNOWN' };
};

/**
 * Words that mark a backend message as written for engineers, not users: the
 * provider names whose errors the backend passes through, and runtime jargon.
 */
const INTERNAL_WORDS =
  /\b(?:rain|wirex|turnkey|temporal|persona|sumsub|didit|alchemy|pimlico|moralis|mongo\w*|axios|fetch|stack|exception|undefined|null|status code|internal server|ECONN\w*|ETIMEDOUT|E11000|TypeError|ReferenceError|cannot read)\b/i;

/**
 * Whether the backend's message reads like copy we can show as-is: short,
 * plain, no URL, hex, JSON, stack or provider jargon. Our own 4xx responses
 * ("That amount is below the minimum") pass; relayed provider errors don't.
 */
export const isSafeServerMessage = (message: string | undefined): message is string => {
  if (!message) return false;
  const text = message.trim();
  return (
    text.length >= 3 &&
    text.length <= ERROR_COPY_LIMITS.sheetBody &&
    !/https?:\/\//i.test(text) &&
    !/0x[0-9a-f]{16,}/i.test(text) &&
    !/[{}[\]<>\n`]/.test(text) &&
    !/^\w*error\b\s*:/i.test(text) &&
    !/\bat \S+ \(/.test(text) &&
    !INTERNAL_WORDS.test(text)
  );
};

const sentence = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`);

const bodyFor = (
  { kind, code, nothingSent }: Classification,
  n: NormalizedError,
  details: ErrorDetails | undefined,
): string => {
  switch (kind) {
    case 'cancelled':
      return '';
    case 'offline':
      return 'Check your connection and try again.';
    case 'timeout':
      return code === 'RECEIPT_TIMEOUT'
        ? 'It may still go through. Check your activity before trying again.'
        : 'This took too long. Check your connection and try again.';
    case 'session':
      return 'Sign in again to continue.';
    case 'rate_limited':
      return 'Too many attempts. Wait a minute and try again.';
    case 'insufficient_funds':
      return 'You don’t have enough balance for this. Lower the amount and try again.';
    case 'rejected':
      if (n.name && USER_COPY_ERROR_NAMES.has(n.name) && n.serverMessage) {
        return sentence(n.serverMessage);
      }
      return isSafeServerMessage(n.serverMessage)
        ? sentence(n.serverMessage)
        : 'Check the details and try again.';
    case 'blockchain':
      if (nothingSent) {
        return details?.amount && details.token
          ? `Nothing was sent. Your ${details.amount} ${details.token} hasn’t moved. Try again in a moment.`
          : 'Nothing was sent. Try again in a moment.';
      }
      return 'It didn’t go through. Check your activity before trying again.';
    case 'server':
      return 'Something went wrong on our side. Try again in a moment.';
    case 'unknown':
    default:
      return 'Try again in a moment. If it keeps happening, contact support.';
  }
};

/**
 * Translate a normalized failure into what we show. Pure: no reporting, no UI.
 * The title says what failed (from the action), the body what to do next.
 */
export const describeError = (n: NormalizedError, context: ErrorContext = {}): UserError => {
  const action = context.action ?? 'generic';
  const classification = classifyError(n);
  const title =
    classification.kind === 'session'
      ? 'Your session expired'
      : (context.title ?? ERROR_ACTIONS[action].title);

  return {
    action,
    kind: classification.kind,
    code: classification.code,
    title: clampText(title, ERROR_COPY_LIMITS.sheetTitle),
    body: clampText(
      context.body ?? bodyFor(classification, n, context.details),
      ERROR_COPY_LIMITS.sheetBody,
    ),
    silent: classification.kind === 'cancelled',
    nothingSent: classification.nothingSent,
    status: n.status,
    requestId: n.requestId,
    technical: sanitizeTechnicalMessage(n.message),
  };
};

/** {@link describeError} for any thrown value, synchronously. */
export const toUserError = (error: unknown, context?: ErrorContext): UserError =>
  describeError(normalizeError(error), context);

/**
 * Just the line to render inline under a field or in a sheet, for screens that
 * keep an error string in state. Never the raw message.
 */
export const getUserErrorMessage = (error: unknown, context?: ErrorContext): string => {
  const userError = toUserError(error, context);
  return userError.silent ? '' : userError.body;
};
