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
