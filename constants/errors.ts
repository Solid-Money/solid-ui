export const ERRORS = {
  USERNAME_ALREADY_EXISTS: 'Username already exists',
  INVALID_INVITE_CODE: 'Invalid referral code',
  WAIT_TRANSACTION_RECEIPT: 'Error waiting for receipt',
  ERROR_SWITCHING_CHAIN: 'Error switching chain',
};

/**
 * Backend code for a login stamp Turnkey could not tie to any user — the passkey
 * is unknown to Turnkey (CREDENTIAL_NOT_FOUND) or its signature did not verify
 * (SIGNATURE_INVALID). Retrying with the same passkey cannot succeed.
 */
export const PASSKEY_NOT_REGISTERED_CODE = 'PASSKEY_NOT_REGISTERED';

/**
 * Backend code for a login stamp Turnkey *did* authenticate, against a
 * sub-organization no Solid account claims.
 *
 * Signup creates the passkey before the sub-organization and the sub-organization
 * before the account row, so a failure part-way through leaves a credential in
 * the keychain that passes Face ID forever and can never sign in.
 */
export const PASSKEY_ACCOUNT_NOT_FOUND_CODE = 'PASSKEY_ACCOUNT_NOT_FOUND';

/**
 * Our own copy for a 404 that arrives without a `code` — an older backend, which
 * answered both cases above with a bare "User not found". Shown instead of that
 * text because the account usually is not missing: it is the passkey that isn't
 * on it, and "User not found" reads as "your money is gone".
 */
export const PASSKEY_UNLINKED_MESSAGE =
  'This passkey is not linked to a Solid account. If you already have an account, ' +
  'recover it to add this device.';

const UNLINKED_PASSKEY_CODES: string[] = [
  PASSKEY_NOT_REGISTERED_CODE,
  PASSKEY_ACCOUNT_NOT_FOUND_CODE,
];

/**
 * Whether a failed login means "the passkey that just signed cannot reach an
 * account", as opposed to a cancelled prompt, a network failure or a closed
 * account.
 *
 * Both shapes are a 404 from `/auths/log-in`, and both share the same two facts:
 * retrying with this passkey cannot succeed, and the way out is recovery — not
 * signup, which refuses the user's own email as already registered.
 */
export const isUnlinkedPasskeyError = (error: unknown): boolean => {
  const err = error as { code?: unknown; status?: unknown; statusCode?: unknown } | null;
  if (!err) return false;

  if (typeof err.code === 'string' && UNLINKED_PASSKEY_CODES.includes(err.code)) return true;

  // An older backend answers untyped. `statusCode` is set alongside `status`
  // only by this app's own ApiError — the shape the login call throws — so
  // requiring both keeps a 404 from elsewhere in the login sequence (viem
  // reaching an RPC host, say) from being read as "your passkey has no account".
  return err.status === 404 && err.statusCode === 404;
};

/**
 * The copy to show for a failed login, derived from the error `handleLogin`
 * re-throws.
 *
 * Deliberately the only place that decides it. `handleLogin` re-throws the
 * original error so callers keep its `status` and `code`, which means every
 * caller holds a raw API message alongside the sanitized one — and reading
 * `error.message` for the toast is how "User not found", the bare 404 of a
 * backend that predates the codes above and the exact phrasing this exists to
 * keep off the screen, reached the user anyway.
 */
export const loginErrorMessage = (error: unknown): string => {
  const err = error as { name?: unknown; code?: unknown; message?: unknown } | null;
  const message = typeof err?.message === 'string' ? err.message : '';

  // WebAuthn reports a dismissed prompt as a failure; the platform's wording for
  // it describes the machinery, not the thing the user just chose to do.
  if (err?.name === 'NotAllowedError') return 'User cancelled login';

  if (isUnlinkedPasskeyError(error)) {
    // A typed reply names which flavour it is, and its copy is the precise one.
    return typeof err?.code === 'string' && message ? message : PASSKEY_UNLINKED_MESSAGE;
  }

  return message || 'Something went wrong. Please try again.';
};
