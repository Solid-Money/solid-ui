/**
 * The app's half of the Errors page contract, copied verbatim from the backend
 * (solid-backend is the source of truth; keep these in step with it).
 *
 * POST {EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/errors/ingest
 * Body: { events: ClientErrorEvent[] } (1..50 events). Response 202 { accepted: number }.
 * Auth is the app's normal auth; unauthenticated calls are accepted too
 * (pre-login errors) but throttled harder by IP.
 */

export type Severity = 'info' | 'warning' | 'error' | 'critical';

export type ErrorFlow =
  | 'deposit'
  | 'withdraw'
  | 'send'
  | 'swap'
  | 'bridge'
  | 'card'
  | 'card_deposit'
  | 'kyc'
  | 'signup'
  | 'login'
  | 'buy_crypto'
  | 'cash_out'
  | 'savings'
  | 'rewards'
  | 'tier'
  | 'app'
  | 'other';

export interface ClientErrorEvent {
  id: string; // client-generated UUID (dedupe key)
  ts: string; // ISO-8601 time it happened on device
  kind: 'toast' | 'api' | 'crash' | 'flow' | 'network';
  flow?: ErrorFlow; // server infers from amplitudeEvent/endpoint if absent
  step?: string; // ≤ 64 chars
  code?: string; // machine code, ≤ 64 chars (e.g. backend `code`, TransFi code)
  message: string; // technical message, already redacted on device, ≤ 2000 chars
  userMessage?: string; // exactly what the user saw (toast text), ≤ 500 chars
  severity?: Severity; // hint only; server decides
  screen?: string; // expo-router pathname, ≤ 200 chars
  platform: 'ios' | 'android' | 'web';
  appVersion?: string; // ≤ 32 chars
  httpStatus?: number;
  endpoint?: string; // API path WITHOUT host or query string, ≤ 200 chars
  amplitudeEvent?: string; // Title-Cased Amplitude event name, e.g. "Deposit Error"
  glitchtipEventId?: string; // id returned by Sentry.captureException
  deviceId?: string; // Amplitude device id (lets us group anonymous errors)
  claimedUsername?: string; // username typed on login (NOT trusted, display only), ≤ 64
  refs?: { clientTxId?: string; activityId?: string; workflowId?: string };
}

export type ClientErrorKind = ClientErrorEvent['kind'];
