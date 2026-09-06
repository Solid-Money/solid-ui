/**
 * Client side of the TransFi error contract.
 *
 * The backend answers every buy-crypto failure with `{ code, message, action }`
 * (see transfi-error.util.ts). `message` is already written for the user, so it
 * is not restated here — this module supplies the parts the server can't know:
 * the headline, and which button the screen offers next.
 */

/** Mirrors TransfiErrorAction on the backend. */
export type TransfiErrorAction =
  | 'retry'
  | 'adjust_amount'
  | 'change_payment_method'
  | 'complete_kyc'
  | 'wait'
  | 'contact_support'
  | 'none';

/** Codes the client has to branch on by name, rather than by action alone. */
export const TRANSFI_ERROR_CODE = {
  PROFILE_DATA_INCOMPLETE: 'TRANSFI_PROFILE_DATA_INCOMPLETE',
  KYC_REQUIRED: 'TRANSFI_KYC_REQUIRED',
  QUOTES_LIMIT_ERROR: 'QUOTES_LIMIT_ERROR',
  UNKNOWN: 'TRANSFI_UNKNOWN_ERROR',
} as const;

/**
 * A buy-crypto failure, in the shape the screens render.
 *
 * Carries `status` so it still satisfies `isHTTPError` — a 401 has to reach
 * withRefreshToken's refresh path rather than being shown as a purchase error.
 */
export class TransfiError extends Error {
  readonly name = 'TransfiError';

  constructor(
    readonly code: string,
    readonly action: TransfiErrorAction,
    message: string,
    readonly status: number,
    readonly details: {
      minLimit?: number;
      maxLimit?: number;
      fiatCurrency?: string;
      missing?: string[];
      transfiKycStatus?: string;
    } = {},
  ) {
    super(message);
  }
}

const GENERIC_MESSAGE =
  'We couldn’t start this purchase. Nothing was charged — please try again later.';

/**
 * Headline for the error screen. The server's `message` explains what happened;
 * this is the two-or-three words above it, so it is keyed off the action rather
 * than duplicating the copy table. A handful of codes get their own line where
 * the generic one would be vaguer than the situation deserves.
 */
const TITLE_BY_CODE: Record<string, string> = {
  COUNTRY_NOT_SUPPORTED: 'Not available in your country',
  COUNTRY_NOT_ALLOWED: 'Not available in your country',
  NATIONALITY_NOT_SUPPORTED: 'Not available for your nationality',
  [TRANSFI_ERROR_CODE.PROFILE_DATA_INCOMPLETE]: 'A few details missing',
  MAXIMUM_LIMIT_BREACHED: 'Purchase limit reached',
  DECLINED_BY_BANK: 'Your bank declined this',
};

const TITLE_BY_ACTION: Record<TransfiErrorAction, string> = {
  retry: 'Something went wrong',
  adjust_amount: 'Amount not accepted',
  change_payment_method: 'Payment method unavailable',
  complete_kyc: 'Finish verifying',
  wait: 'Still being reviewed',
  contact_support: 'We can’t complete this',
  none: 'Can’t buy crypto',
};

export const transfiErrorTitle = (error: TransfiError): string =>
  TITLE_BY_CODE[error.code] ?? TITLE_BY_ACTION[error.action];

const ACTIONS: readonly TransfiErrorAction[] = [
  'retry',
  'adjust_amount',
  'change_payment_method',
  'complete_kyc',
  'wait',
  'contact_support',
  'none',
];

const isAction = (value: unknown): value is TransfiErrorAction =>
  ACTIONS.includes(value as TransfiErrorAction);

/**
 * Read a failed fetch into a TransfiError.
 *
 * Falls back to the generic retry message for any body that isn't ours — a
 * gateway HTML page, an empty 502 — because the alternative the buy screen had
 * before was showing nothing at all.
 */
export const toTransfiError = async (response: Response): Promise<TransfiError> => {
  let body: Record<string, unknown> | undefined;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = undefined;
  }
  const code = typeof body?.code === 'string' ? body.code : TRANSFI_ERROR_CODE.UNKNOWN;
  const message = typeof body?.message === 'string' ? body.message : GENERIC_MESSAGE;
  // An unrecognised body is still worth retrying; a recognised one carries its
  // own verdict on that.
  const action = isAction(body?.action) ? body.action : 'retry';
  return new TransfiError(code, action, message, response.status, {
    minLimit: typeof body?.minLimit === 'number' ? body.minLimit : undefined,
    maxLimit: typeof body?.maxLimit === 'number' ? body.maxLimit : undefined,
    fiatCurrency: typeof body?.fiatCurrency === 'string' ? body.fiatCurrency : undefined,
    missing: Array.isArray(body?.missing)
      ? body.missing.filter((item): item is string => typeof item === 'string')
      : undefined,
    transfiKycStatus:
      typeof body?.transfiKycStatus === 'string' ? body.transfiKycStatus : undefined,
  });
};

/**
 * Coerce anything thrown during the flow into something the error screen can
 * render — a dropped connection reaches the mutation as a bare TypeError, and
 * "Failed to fetch" is not an explanation.
 */
export const asTransfiError = (error: unknown): TransfiError => {
  if (error instanceof TransfiError) return error;
  return new TransfiError(TRANSFI_ERROR_CODE.UNKNOWN, 'retry', GENERIC_MESSAGE, 0);
};

/** Profile fields a user can supply themselves; see TransfiProfileForm. */
export const FILLABLE_PROFILE_FIELDS = ['residential address', 'phone number'] as const;

/**
 * Whether the incomplete-profile error can be resolved by the user filling a
 * form. Name, date of birth and email come from the verified identity — asking
 * the user to retype those would only make the profile disagree with the
 * documents TransFi is about to be shown, so those go to support instead.
 */
export const canCompleteProfile = (error: TransfiError): boolean =>
  error.code === TRANSFI_ERROR_CODE.PROFILE_DATA_INCOMPLETE &&
  (error.details.missing?.length ?? 0) > 0 &&
  (error.details.missing ?? []).every(field =>
    (FILLABLE_PROFILE_FIELDS as readonly string[]).includes(field),
  );
