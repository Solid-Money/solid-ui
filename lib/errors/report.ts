import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Sentry from '@sentry/react-native';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { reportClientError } from '@/lib/api';
import {
  ErrorDetails,
  ErrorKind,
  ErrorSurface,
  NormalizedError,
  normalizeError,
  UserError,
} from '@/lib/errors/classify';
import { compactErrorRef, formatErrorRef, isHex32, newEventId } from '@/lib/errors/errorRef';
import { sanitizeTechnicalMessage } from '@/lib/errors/sanitize';
import { reportShownError } from '@/lib/telemetry/shownErrors';

/** A reported failure: what support needs to find it again. */
export interface ErrorReport {
  /** `9C1B-4F2A`, shown to the user. */
  ref: string;
  /** Full 32-hex GlitchTip event ID. */
  eventId: string;
  occurredAt: Date;
}

/**
 * Families we always report. Everything else (offline, cancelled, a session that
 * expired, a business-rule rejection) is expected: reporting it would bury real
 * failures, and its Ref would point at nothing anyone needs to read.
 */
const UNEXPECTED_KINDS: ReadonlySet<ErrorKind> = new Set(['blockchain', 'server', 'unknown']);

/** On a failure sheet a Ref is the point, so only the truly empty cases go without one. */
const NEVER_REPORTED_KINDS: ReadonlySet<ErrorKind> = new Set(['cancelled', 'offline', 'session']);

export const shouldReport = (kind: ErrorKind, surface: ErrorSurface): boolean =>
  surface === 'sheet' ? !NEVER_REPORTED_KINDS.has(kind) : UNEXPECTED_KINDS.has(kind);

/** The same thrown object is reported once, and keeps its Ref if shown again. */
const reported = new WeakMap<object, ErrorReport>();

/** Event IDs handed out before a failure is shown (see {@link eventIdForError}). */
const assignedEventIds = new WeakMap<object, string>();

/**
 * The event ID a failure will be reported under, fixed the first time anyone
 * asks. Lets code that records a failure before the UI shows it (an activity
 * marked failed, say) store the same Ref the user is about to see: the failing
 * call's request ID when already known, else an ID minted now and reused even
 * if asynchronous response parsing later discovers a request ID.
 */
export const eventIdForError = (error: unknown, requestId?: string): string => {
  if (error === null || typeof error !== 'object') {
    return isHex32(requestId) ? requestId : newEventId();
  }
  const assigned = assignedEventIds.get(error);
  if (assigned) return assigned;
  const eventId = isHex32(requestId) ? requestId : newEventId();
  assignedEventIds.set(error, eventId);
  return eventId;
};

/**
 * Metadata for an activity marked failed: the sanitized cause, and the Ref the
 * failure sheet will show, so support can go from either one to the other.
 */
export const activityFailureMetadata = (
  error: unknown,
  fallback = 'Transaction failed',
): { error: string; errorRef: string; errorEventId: string; failedAt: string } => {
  const eventId = eventIdForError(error, normalizeError(error).requestId);
  return {
    error: sanitizeTechnicalMessage(error) || fallback,
    errorRef: formatErrorRef(eventId),
    errorEventId: eventId,
    failedAt: new Date().toISOString(),
  };
};

/**
 * What GlitchTip receives when the thrown value can't be sent as-is: a raw
 * `Response` (which Sentry files as "Object captured as exception with keys:
 * _bodyBlob…", today's second-biggest issue), or an error some other code
 * already captured, which Sentry would silently refuse a second time while
 * still returning an event ID that then points at nothing.
 */
class UserFacingError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'UserFacingError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

const wasCaptured = (value: unknown): boolean => {
  try {
    return Boolean((value as { __sentry_captured__?: boolean } | null)?.__sentry_captured__);
  } catch {
    return false;
  }
};

const currentRoute = (): string | undefined =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.pathname : undefined;

const platformName = (): 'ios' | 'android' | 'web' | undefined =>
  Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
    ? Platform.OS
    : undefined;

/**
 * Report a failure the user is about to see, and hand back its Ref.
 *
 * One ID, everywhere: when one of our API calls failed, the GlitchTip event ID
 * *is* that call's `X-Request-Id`, so the Ref (its first 8 characters) also
 * matches every backend log line the request wrote. Otherwise a fresh ID is
 * minted. The same ID is then tagged on the event (`error_ref`, searchable in
 * GlitchTip), sent to Amplitude and stored by the backend (`clientErrors`),
 * which is what the admin portal's Error lookup reads.
 *
 * Returns undefined for failures we don't report (see {@link shouldReport}).
 */
export const reportUserError = (
  normalized: NormalizedError,
  userError: UserError,
  surface: ErrorSurface,
  details?: ErrorDetails,
  /** Extra GlitchTip tags, e.g. `{ source: 'error_boundary' }` for continuity with old events. */
  extraTags?: Record<string, string>,
): ErrorReport | undefined => {
  const original = normalized.original;
  const key = original !== null && typeof original === 'object' ? original : undefined;
  const existing = key ? reported.get(key) : undefined;

  const analytics = {
    error_code: userError.code,
    error_kind: userError.kind,
    error_action: userError.action,
    surface,
    http_status: userError.status,
    request_id: userError.requestId,
  };

  if (existing) return existing;
  if (!shouldReport(userError.kind, surface)) {
    track(TRACKING_EVENTS.ERROR_SHOWN, analytics);
    // No Ref, but still something the user ran into: the admin Errors page
    // gets it directly. Reported ones reach it through `clientErrors`.
    reportShownError({
      action: userError.action,
      code: userError.code,
      kind: userError.kind,
      surface,
      title: userError.title,
      body: userError.body,
      technical: userError.technical || undefined,
      status: userError.status,
      requestId: userError.requestId,
    });
    return undefined;
  }

  const eventId = eventIdForError(original, userError.requestId);
  const ref = formatErrorRef(eventId);
  const report: ErrorReport = { ref, eventId, occurredAt: new Date() };
  if (key) reported.set(key, report);

  const target =
    original instanceof Error && !wasCaptured(original)
      ? original
      : new UserFacingError(
          `${userError.action} failed: ${userError.code}`,
          original instanceof Error ? original : undefined,
        );

  Sentry.captureException(target, {
    event_id: eventId,
    captureContext: {
      level: 'error',
      tags: {
        ...extraTags,
        error_ref: ref,
        error_code: userError.code,
        error_kind: userError.kind,
        error_action: userError.action,
        error_surface: surface,
        ...(userError.requestId ? { request_id: userError.requestId } : {}),
        ...(userError.status ? { http_status: String(userError.status) } : {}),
      },
      // A classified cause groups as one issue per action and cause, not one
      // per stack trace. Unknown ones keep the default grouping, or every
      // distinct crash would collapse into a single issue.
      ...(userError.kind !== 'unknown'
        ? { fingerprint: ['user-facing-error', userError.action, userError.code] }
        : {}),
      contexts: {
        user_facing_error: {
          title: userError.title,
          body: userError.body,
          technical: userError.technical,
          nothing_sent: userError.nothingSent,
          path: normalized.path,
        },
      },
    },
  });

  track(TRACKING_EVENTS.ERROR_SHOWN, { ...analytics, error_ref: ref, event_id: eventId });

  reportClientError({
    ref: compactErrorRef(ref),
    eventId,
    requestId: userError.requestId,
    action: userError.action,
    code: userError.code,
    kind: userError.kind,
    surface,
    title: userError.title,
    body: userError.body,
    message: userError.technical || undefined,
    httpStatus: userError.status,
    nothingSent: userError.nothingSent,
    platform: platformName(),
    appVersion: Application.nativeApplicationVersion ?? undefined,
    route: currentRoute(),
    details,
    occurredAt: report.occurredAt.toISOString(),
  }).catch(() => {
    // Telemetry about a failure must never become a second failure.
  });

  return report;
};
