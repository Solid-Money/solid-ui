import { TRACKING_EVENTS } from '@/constants/tracking-events';

/**
 * Amplitude error events: failed flows, tracked under names that say so
 * (`deposit_error`, `card_activation_failed`, …).
 *
 * The admin Errors page imports these from Amplitude for builds that do not
 * report errors live. This build does, through what the user is shown
 * (`lib/errors`), so `track()` flags its failure events for the import to skip.
 */

/** Names ending in one of these are failures. */
const ERROR_SUFFIXES = ['_failed', '_error', '_rejected', '_declined', '_blocked', '_unavailable'];

/** Failures whose names do not say so. */
const ERROR_EVENTS = new Set<string>([
  TRACKING_EVENTS.ERROR_BOUNDARY,
  TRACKING_EVENTS.REGION_UNAVAILABLE_SHOWN,
  TRACKING_EVENTS.QR_SCANNER_PERMISSION_DENIED,
]);

/**
 * Names that match a suffix but are not something going wrong in the app: the
 * OS has no review sheet, or an ad blocker kept a third-party widget out.
 */
const NOT_ERROR_EVENTS = new Set<string>([
  TRACKING_EVENTS.STORE_REVIEW_UNAVAILABLE,
  TRACKING_EVENTS.TRUSTPILOT_WIDGET_UNAVAILABLE,
]);

/**
 * Whether a tracked event records something failing. User decisions and
 * impressions (`*_cancelled`, `*_viewed`, `*_pressed`) never match a suffix, so
 * they stay out unless listed in {@link ERROR_EVENTS}.
 */
export const isErrorEvent = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false;
  const event = name.toLowerCase();
  if (NOT_ERROR_EVENTS.has(event)) return false;
  return ERROR_EVENTS.has(event) || ERROR_SUFFIXES.some(suffix => event.endsWith(suffix));
};
