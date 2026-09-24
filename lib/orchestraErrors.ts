/**
 * Client side of the Orchestra error contract.
 *
 * Orchestra answers failures with `{"error":{"code","message"}}` — a nested body
 * rather than TransFi's flat one, and a `message` written for an integrator
 * rather than for the person holding the phone. So unlike `transfiErrors.ts`,
 * this module supplies the user-facing copy as well: the code decides what we
 * say, and the raw message is kept only for telemetry.
 *
 * Codes come from https://docs.flashnet.xyz/api/errors.
 */

/** What the screen offers next. Mirrors the shape the TransFi error screen uses. */
export type OrchestraErrorAction = 'retry' | 'adjust_amount' | 'contact_support' | 'none';

export const ORCHESTRA_ERROR_CODE = {
  AMOUNT_TOO_SMALL: 'amount_too_small',
  AMOUNT_TOO_LARGE: 'amount_too_large',
  ROUTE_UNAVAILABLE: 'route_unavailable',
  ROUTE_DISABLED: 'route_disabled',
  UNSUPPORTED_ROUTE: 'unsupported_route',
  AMOUNT_EXCEEDS_LIQUIDITY: 'amount_exceeds_liquidity',
  PRICE_IMPACT_TOO_HIGH: 'price_impact_too_high',
  SPOT_UNAVAILABLE: 'spot_unavailable',
  RATE_LIMITED: 'rate_limited',
  ORIGIN_NOT_ALLOWED: 'origin_not_allowed',
  ORIGIN_REQUIRED: 'origin_required',
  READ_TOKEN_REQUIRED: 'read_token_required',
  INVALID_READ_TOKEN: 'invalid_read_token',
  SCOPE_REQUIRED: 'scope_required',
  ACCOUNT_PENDING_APPROVAL: 'account_pending_approval',
  // Codes our own backend raises, as opposed to Orchestra's.
  NOT_CONFIGURED: 'ORCHESTRA_NOT_CONFIGURED',
  /** Raised by the client, not the server: the rail is US-only. */
  REGION_UNSUPPORTED: 'ORCHESTRA_REGION_UNSUPPORTED',
  NO_WALLET_ADDRESS: 'ORCHESTRA_NO_WALLET_ADDRESS',
  ORDER_NOT_YOURS: 'ORCHESTRA_ORDER_NOT_YOURS',
  UNKNOWN: 'unknown_error',
} as const;

const GENERIC_MESSAGE =
  'We couldn’t start this deposit. Nothing was charged — please try again in a moment.';

/**
 * An onramp failure in the shape the screens render.
 *
 * Carries `status` so it still satisfies `isHTTPError`, and `action` so the
 * error screen knows which button to show without re-deriving it from the code.
 */
export class OrchestraError extends Error {
  readonly name = 'OrchestraError';

  constructor(
    readonly code: string,
    readonly action: OrchestraErrorAction,
    message: string,
    readonly status: number,
    /** Orchestra's own wording, for Sentry and Amplitude — not for the screen. */
    readonly rawMessage?: string,
  ) {
    super(message);
  }
}

/**
 * What the user is told, by code.
 *
 * Anything not listed falls through to the generic retry line. The
 * configuration and scope failures deliberately say something bland: a user can
 * do nothing about a missing client key or a disallowed origin, and the code
 * itself is what the on-call engineer needs, which telemetry already carries.
 */
const MESSAGE_BY_CODE: Record<string, string> = {
  [ORCHESTRA_ERROR_CODE.AMOUNT_TOO_SMALL]: 'That amount is below the minimum for this deposit.',
  [ORCHESTRA_ERROR_CODE.AMOUNT_TOO_LARGE]: 'That amount is above the maximum for this deposit.',
  [ORCHESTRA_ERROR_CODE.AMOUNT_EXCEEDS_LIQUIDITY]:
    'That amount is more than we can convert right now. Try a smaller one.',
  [ORCHESTRA_ERROR_CODE.PRICE_IMPACT_TOO_HIGH]:
    'The rate moved too far to complete this. Try a smaller amount.',
  [ORCHESTRA_ERROR_CODE.ROUTE_UNAVAILABLE]: 'This deposit route is unavailable right now.',
  [ORCHESTRA_ERROR_CODE.ROUTE_DISABLED]: 'This deposit route is unavailable right now.',
  [ORCHESTRA_ERROR_CODE.UNSUPPORTED_ROUTE]: 'This deposit route is unavailable right now.',
  [ORCHESTRA_ERROR_CODE.SPOT_UNAVAILABLE]:
    'We can’t price a USD amount at the moment. Please try again shortly.',
  [ORCHESTRA_ERROR_CODE.RATE_LIMITED]: 'Too many attempts. Please wait a moment and try again.',
  // Not a user problem and not retryable: Flashnet reviews new partner accounts
  // before activating their keys, so the key is valid and simply not live yet.
  // Without this it fell through to "try again in a moment", which is advice
  // that can only waste the reader's time.
  [ORCHESTRA_ERROR_CODE.ACCOUNT_PENDING_APPROVAL]:
    'This deposit method isn’t live yet. (Flashnet hasn’t approved the account.)',
  [ORCHESTRA_ERROR_CODE.ORIGIN_NOT_ALLOWED]: 'This deposit method isn’t available here.',
  [ORCHESTRA_ERROR_CODE.SCOPE_REQUIRED]: 'This deposit method isn’t available right now.',
  [ORCHESTRA_ERROR_CODE.NOT_CONFIGURED]:
    'This deposit method isn’t available yet. (The server has no Orchestra key.)',
  [ORCHESTRA_ERROR_CODE.NO_WALLET_ADDRESS]: 'Your wallet isn’t ready yet. Try again in a moment.',
  [ORCHESTRA_ERROR_CODE.ORDER_NOT_YOURS]: 'We couldn’t find that deposit.',
  // Order-level failures, read off order.errorCode rather than an HTTP body.
  slippage_exceeded: 'The rate moved while we were converting. Your payment is being refunded.',
  refund_address_missing: 'Something went wrong and we couldn’t refund automatically.',
  duplicate_lightning_invoice: 'That invoice has already been paid.',
};

const ACTION_BY_CODE: Record<string, OrchestraErrorAction> = {
  [ORCHESTRA_ERROR_CODE.AMOUNT_TOO_SMALL]: 'adjust_amount',
  [ORCHESTRA_ERROR_CODE.AMOUNT_TOO_LARGE]: 'adjust_amount',
  [ORCHESTRA_ERROR_CODE.AMOUNT_EXCEEDS_LIQUIDITY]: 'adjust_amount',
  [ORCHESTRA_ERROR_CODE.PRICE_IMPACT_TOO_HIGH]: 'adjust_amount',
  [ORCHESTRA_ERROR_CODE.ROUTE_UNAVAILABLE]: 'none',
  [ORCHESTRA_ERROR_CODE.ROUTE_DISABLED]: 'none',
  [ORCHESTRA_ERROR_CODE.UNSUPPORTED_ROUTE]: 'none',
  [ORCHESTRA_ERROR_CODE.NOT_CONFIGURED]: 'none',
  [ORCHESTRA_ERROR_CODE.NO_WALLET_ADDRESS]: 'retry',
  [ORCHESTRA_ERROR_CODE.REGION_UNSUPPORTED]: 'none',
  [ORCHESTRA_ERROR_CODE.ORDER_NOT_YOURS]: 'none',
  [ORCHESTRA_ERROR_CODE.ORIGIN_NOT_ALLOWED]: 'contact_support',
  [ORCHESTRA_ERROR_CODE.ORIGIN_REQUIRED]: 'contact_support',
  [ORCHESTRA_ERROR_CODE.SCOPE_REQUIRED]: 'contact_support',
  [ORCHESTRA_ERROR_CODE.ACCOUNT_PENDING_APPROVAL]: 'contact_support',
  refund_address_missing: 'contact_support',
  slippage_exceeded: 'none',
};

const TITLE_BY_ACTION: Record<OrchestraErrorAction, string> = {
  retry: 'Something went wrong',
  adjust_amount: 'Amount not accepted',
  contact_support: 'We can’t complete this',
  none: 'Deposit unavailable',
};

export const orchestraErrorTitle = (error: OrchestraError): string => TITLE_BY_ACTION[error.action];

/** Build an error from a code alone — used for order-level failures from /status. */
export const orchestraErrorFromCode = (code: string | undefined, status = 0): OrchestraError => {
  const resolved = code ?? ORCHESTRA_ERROR_CODE.UNKNOWN;
  return new OrchestraError(
    resolved,
    ACTION_BY_CODE[resolved] ?? 'retry',
    MESSAGE_BY_CODE[resolved] ?? GENERIC_MESSAGE,
    status,
    code,
  );
};

/**
 * Read a failed fetch into an OrchestraError.
 *
 * Orchestra nests the body under `error`, but a 502 from a gateway or an empty
 * 503 arrives as HTML or nothing at all — both fall through to the generic
 * retry line rather than surfacing a parse failure the user can't act on.
 */
export const toOrchestraError = async (response: Response): Promise<OrchestraError> => {
  let body: { error?: { code?: unknown; message?: unknown } } | undefined;
  try {
    body = (await response.json()) as typeof body;
  } catch {
    body = undefined;
  }
  const code = typeof body?.error?.code === 'string' ? body.error.code : undefined;
  const rawMessage = typeof body?.error?.message === 'string' ? body.error.message : undefined;
  const error = orchestraErrorFromCode(code, response.status);
  return new OrchestraError(error.code, error.action, error.message, response.status, rawMessage);
};

/**
 * Coerce anything thrown during the flow into something the screens can render.
 * A dropped connection reaches the mutation as a bare TypeError, and "Failed to
 * fetch" is not an explanation.
 */
export const asOrchestraError = (error: unknown): OrchestraError => {
  if (error instanceof OrchestraError) return error;
  return new OrchestraError(
    ORCHESTRA_ERROR_CODE.UNKNOWN,
    'retry',
    GENERIC_MESSAGE,
    0,
    error instanceof Error ? error.message : undefined,
  );
};
