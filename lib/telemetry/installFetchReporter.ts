import {
  EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL,
  EXPO_PUBLIC_FLASH_API_BASE_URL,
  EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL,
  EXPO_PUBLIC_FLASH_VAULT_MANAGER_API_BASE_URL,
} from '@/lib/config';
import { ERROR_INGEST_URL, isErrorIngestEnabled } from '@/lib/telemetry/errorIngestQueue';
import { reportError } from '@/lib/telemetry/reportError';
import { isNetworkError } from '@/lib/utils/userFacingError';

/**
 * Failed calls to our own backend, reported to the admin Errors page.
 *
 * Most of lib/api.ts is plain `fetch` ending in `throw response`, so a failing
 * endpoint left no trace anywhere unless the screen happened to track it. The
 * global `fetch` is wrapped once at startup instead: for our own services only,
 * a 4xx/5xx response and a connection failure are reported. The caller gets back
 * exactly what `fetch` gave — the same Response object, or the same error — and
 * every other host gets the untouched original promise.
 */

const REPORTER_MARK = '__solidErrorReporter';

type MarkedFetch = typeof fetch & { [REPORTER_MARK]?: true };

/** `fetch` has one overload per lib (DOM, React Native); call it without picking one. */
type AnyFetch = (this: unknown, ...args: unknown[]) => Promise<Response>;

const OWN_BASE_URLS = [
  EXPO_PUBLIC_FLASH_API_BASE_URL,
  EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL,
  EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL,
  EXPO_PUBLIC_FLASH_VAULT_MANAGER_API_BASE_URL,
]
  .filter(Boolean)
  .map(base => base.replace(/\/+$/, ''));

/** The URL of a `fetch` input: a string, a URL or a Request. */
export const requestUrl = (input: unknown): string | undefined => {
  try {
    if (typeof input === 'string') return input;
    if (input && typeof input === 'object') {
      const { url, href } = input as { url?: unknown; href?: unknown };
      if (typeof url === 'string') return url; // Request
      if (typeof href === 'string') return href; // URL
    }
  } catch {
    // An exotic input with throwing getters: not ours to report.
  }
  return undefined;
};

const startsWithBase = (url: string, base: string) =>
  url.startsWith(base) && /^($|[/?#])/.test(url.slice(base.length));

/**
 * One of our services, and not the ingest endpoint itself — reporting the
 * reporter's own failures would feed them straight back into its queue.
 */
export const isReportableUrl = (url: string): boolean =>
  !url.startsWith(ERROR_INGEST_URL) && OWN_BASE_URLS.some(base => startsWithBase(url, base));

/**
 * The path, without scheme, host, query or fragment. Parsed by hand: React
 * Native's `URL` does not implement `pathname`.
 */
export const endpointOf = (url: string): string => {
  const [withoutQuery] = url.split(/[?#]/, 1);
  const schemeEnd = withoutQuery.indexOf('://');
  if (schemeEnd === -1) return withoutQuery || '/';
  const pathStart = withoutQuery.indexOf('/', schemeEnd + 3);
  return pathStart === -1 ? '/' : withoutQuery.slice(pathStart);
};

/** The request method, from `init` or a Request input. */
export const requestMethod = (input: unknown, init: unknown): string => {
  try {
    const method =
      (init as RequestInit | undefined)?.method ?? (input as Request | undefined)?.method;
    return typeof method === 'string' ? method.toUpperCase() : 'GET';
  } catch {
    return 'GET';
  }
};

/**
 * Failures that are answers, not errors:
 * - 401: the token refresh handles it (and retries the call).
 * - 404 on a read: "there is none" — the card status, Bridge customer, latest
 *   What's New and others answer that way on every app open for most users, and
 *   their callers turn it into `null`.
 */
export const isExpectedFailure = (status: number, method: string): boolean =>
  status === 401 || (status === 404 && (method === 'GET' || method === 'HEAD'));

/** Our backend answers `{ code?, message }`, where `message` may be a list. */
const errorBodyMessage = (body: any): string | undefined => {
  const message = body?.message;
  if (Array.isArray(message)) {
    const joined = message.filter(part => typeof part === 'string' && part).join('; ');
    if (joined) return joined;
  }
  if (typeof message === 'string' && message.trim()) return message;
  if (typeof body?.error === 'string' && body.error.trim()) return body.error;
  return undefined;
};

const reportFailedResponse = (response: Response, url: string, method: string) => {
  const { status, statusText } = response;
  if (status < 400 || isExpectedFailure(status, method)) return;

  const endpoint = endpointOf(url);
  const report = (body?: any) => {
    const code = body?.code;
    reportError({
      kind: 'api',
      httpStatus: status,
      endpoint,
      code: typeof code === 'string' || typeof code === 'number' ? code : undefined,
      message: errorBodyMessage(body) || statusText || `HTTP ${status}`,
    });
  };

  // Cloned before the caller sees the response, so reading the copy can never
  // race the caller reading (and locking) the original body.
  let copy: Response | undefined;
  try {
    copy = response.clone();
  } catch {
    copy = undefined;
  }
  if (!copy) {
    report();
    return;
  }
  copy.json().then(report, () => report());
};

const reportFailedRequest = (error: unknown, url: string) => {
  if (!isNetworkError(error)) return;
  reportError({
    kind: 'network',
    severity: 'warning',
    endpoint: endpointOf(url),
    message: error instanceof Error ? error.message : String(error),
  });
};

/** Wrap the global `fetch` once; safe to call again (including after a fast refresh). */
export const installFetchReporter = () => {
  try {
    if (!isErrorIngestEnabled()) return;
    const original = globalThis.fetch as MarkedFetch | undefined;
    if (typeof original !== 'function' || original[REPORTER_MARK]) return;

    const call = original as unknown as AnyFetch;
    const reportingFetch = function (this: unknown, ...args: unknown[]) {
      const pending = call.apply(this, args);

      const url = requestUrl(args[0]);
      if (!url || !isReportableUrl(url)) return pending;

      return pending.then(
        response => {
          try {
            reportFailedResponse(response, url, requestMethod(args[0], args[1]));
          } catch {
            // The response is the caller's whatever happens here.
          }
          return response;
        },
        error => {
          try {
            reportFailedRequest(error, url);
          } catch {
            // Rethrown below regardless.
          }
          throw error;
        },
      );
    } as MarkedFetch;

    // Keep anything hung on the original (whatwg-fetch sets `fetch.polyfill`).
    Object.assign(reportingFetch, original);
    reportingFetch[REPORTER_MARK] = true;
    globalThis.fetch = reportingFetch;
  } catch {
    // Leave fetch untouched if anything about it is unexpected.
  }
};
