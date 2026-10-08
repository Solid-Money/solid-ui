import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { reportError, type ReportErrorInput } from '@/lib/telemetry/reportError';

import type { ErrorFlow } from '@/lib/telemetry/types';

/**
 * Amplitude error events, mirrored to the admin Errors page.
 *
 * Failed flows are already tracked to Amplitude under names that say so
 * (`deposit_error`, `card_activation_failed`, …), with the reason in whichever
 * property that screen happened to use. This picks those events out by name and
 * reads the reason back out, so each one also lands on the Errors page without
 * touching the call sites.
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

/** First match wins, so the more specific prefixes come first. */
const FLOW_PREFIXES: [prefix: string, flow: ErrorFlow][] = [
  [TRACKING_EVENTS.ERROR_BOUNDARY, 'app'],
  ['card_deposit_', 'card_deposit'],
  ['card_kyc_', 'kyc'],
  ['kyc_link_', 'kyc'],
  ['card_', 'card'],
  ['deposit_', 'deposit'],
  ['virtual_account_', 'deposit'],
  ['withdraw_', 'withdraw'],
  ['fast_withdraw_', 'withdraw'],
  ['cancel_withdraw_', 'withdraw'],
  ['send_', 'send'],
  ['cross_chain_send_', 'send'],
  ['swap_', 'swap'],
  ['peg_swap_', 'swap'],
  ['wrap_', 'swap'],
  ['bridge_to_', 'bridge'],
  ['buy_crypto_', 'buy_crypto'],
  ['orchestra_', 'buy_crypto'],
  ['onramper_', 'buy_crypto'],
  ['cash_out_', 'cash_out'],
  ['signup_', 'signup'],
  ['email_verification_', 'signup'],
  ['passkey_', 'signup'],
  ['username_', 'signup'],
  ['login_', 'login'],
  ['tier_', 'tier'],
  ['quest_', 'rewards'],
];

/** The product flow an event belongs to, from its name. */
export const inferErrorFlow = (name: string): ErrorFlow => {
  const event = name.toLowerCase();
  return FLOW_PREFIXES.find(([prefix]) => event.startsWith(prefix))?.[1] ?? 'other';
};

/** A property as text: strings, numbers and Error-likes; anything else is ignored. */
const textOf = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object' && typeof (value as Error).message === 'string') {
    return (value as Error).message.trim() || undefined;
  }
  return undefined;
};

const firstText = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const text = textOf(value);
    if (text) return text;
  }
  return undefined;
};

/**
 * The Errors page report for a tracked error event. Call sites name the reason
 * inconsistently, so every key in use is tried in order of how specific it is.
 */
export const toFlowErrorReport = (
  name: string,
  amplitudeEvent: string,
  params: Record<string, any> = {},
): ReportErrorInput => {
  const clientTxId = firstText(params.clientTxId, params.client_tx_id);

  return {
    kind: 'flow',
    flow: inferErrorFlow(name),
    amplitudeEvent,
    message:
      firstText(
        params.error,
        params.error_message,
        params.message,
        params.reason,
        params.error_type,
        params.error_cause_message,
      ) ?? name,
    code: firstText(params.error_code, params.code, params.error_kind, params.error_type),
    step: firstText(params.step, params.failed_stage),
    refs: clientTxId ? { clientTxId } : undefined,
    // What was typed on the login screen: unverified, shown only to tell
    // anonymous login failures apart.
    claimedUsername: name === TRACKING_EVENTS.LOGIN_FAILED ? firstText(params.username) : undefined,
  };
};

/**
 * Mirror a tracked error event to the Errors page. `error_boundary` is skipped:
 * the boundary reports the crash itself, with the GlitchTip event id attached.
 */
export const reportFlowError = (
  name: string,
  amplitudeEvent: string,
  params: Record<string, any> = {},
) => {
  try {
    if (name === TRACKING_EVENTS.ERROR_BOUNDARY) return;
    reportError(toFlowErrorReport(name, amplitudeEvent, params));
  } catch {
    // Never let this reach the caller of track().
  }
};
