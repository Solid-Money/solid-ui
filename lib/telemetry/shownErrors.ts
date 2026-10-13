import type { ReportErrorInput } from '@/lib/telemetry/reportError';
import type { ClientErrorKind, ErrorFlow } from '@/lib/telemetry/types';

/**
 * Failures the shared error path (`lib/errors`) showed, on the admin Errors
 * page.
 *
 * The ones it reports itself (`reportUserError` → `POST /client-errors`) reach
 * the page through the backend, Ref included. This covers the rest: expected
 * failures such as a wrong code, too little balance or being offline, which
 * get no Ref but are still something a user ran into.
 *
 * Kept free of the reporting stack (Amplitude, the ingest queue): `lib/errors`
 * imports this, and the root layout plugs the reporter in with
 * `installShownErrorReporter`. Until then a report goes nowhere.
 */

/** `ErrorAction` (lib/errors/actions.ts) → the Errors page's flow. Kept in step with the backend's copy. */
const ACTION_FLOWS: Record<string, ErrorFlow> = {
  move_to_card: 'card_deposit',
  card_deposit: 'card_deposit',
  card_withdraw: 'card',
  card_repay: 'card',
  credit_line: 'card',
  card_order: 'card',
  card_activate: 'card',
  card_reveal: 'card',
  card_settings: 'card',
  add_to_wallet: 'card',
  deposit: 'deposit',
  savings_deposit: 'savings',
  withdraw: 'withdraw',
  send: 'send',
  swap: 'swap',
  bridge: 'bridge',
  claim: 'rewards',
  referral: 'rewards',
  kyc: 'kyc',
  sign_in: 'login',
  passkey: 'login',
  sign_up: 'signup',
  subscription: 'tier',
  account: 'app',
  load: 'app',
  refresh: 'app',
  generic: 'app',
};

export const flowForAction = (action: string): ErrorFlow | undefined => ACTION_FLOWS[action];

export interface ShownErrorInput {
  action: string;
  code: string;
  kind: string;
  surface: 'sheet' | 'toast' | 'inline' | 'screen';
  title: string;
  body?: string;
  /** Sanitized technical cause, when there is one. */
  technical?: string;
  status?: number;
  requestId?: string;
}

const kindFor = (input: ShownErrorInput): ClientErrorKind => {
  if (input.surface === 'screen') return 'crash';
  if (input.kind === 'offline' || input.kind === 'timeout') return 'network';
  return input.surface === 'toast' ? 'toast' : 'flow';
};

/** The Errors page report for a failure the user was shown, or undefined for a cancelled prompt. */
export const toShownErrorReport = (input: ShownErrorInput): ReportErrorInput | undefined => {
  if (input.kind === 'cancelled') return undefined;
  const userMessage = input.body ? `${input.title}. ${input.body}` : input.title;
  return {
    kind: kindFor(input),
    flow: flowForAction(input.action),
    step: input.action,
    code: input.code,
    message: input.technical || userMessage,
    userMessage,
    httpStatus: input.status,
    refs: input.requestId ? { requestId: input.requestId } : undefined,
  };
};

let sink: ((report: ReportErrorInput) => void) | undefined;

/** Where shown failures are reported; set once at startup. */
export const setShownErrorSink = (next: ((report: ReportErrorInput) => void) | undefined) => {
  sink = next;
};

/** Report a failure the user was shown that has no Ref. Never throws. */
export const reportShownError = (input: ShownErrorInput): void => {
  try {
    if (!sink) return;
    const report = toShownErrorReport(input);
    if (report) sink(report);
  } catch {
    // Reporting a failure must never become a second one.
  }
};

// --- Toasts the shared path showed ------------------------------------------

/**
 * `Toast.show` params the shared path built. The toast reporter, which reports
 * every other error toast, leaves these alone: the shared path already
 * reported them, with more to say than the toast's text.
 */
const sharedPathToasts = new WeakSet<object>();

export const markSharedPathToast = <T extends object>(params: T): T => {
  sharedPathToasts.add(params);
  return params;
};

export const isSharedPathToast = (params: unknown): boolean =>
  typeof params === 'object' && params !== null && sharedPathToasts.has(params);
