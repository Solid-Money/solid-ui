/**
 * The backend now pulls a connected-wallet vault deposit only from the user's
 * own Safe (solid-backend #2180). Before that it pulled from whatever address
 * the request named, so any signed-in user could name another user's Safe and
 * take the funds it had approved.
 *
 * A deposit from a connected external wallet is therefore refused with a 403.
 * The desktop "Send from your crypto wallet" option is hidden (see
 * getVaultDepositConfig), and the hooks behind it stop before any wallet prompt
 * so a tab still running the old bundle does not approve, or wrap ETH, only to
 * be refused afterwards.
 */
export const EXTERNAL_WALLET_DEPOSIT_PAUSED =
  'Deposits from a connected wallet are paused. Send to your Solid deposit address instead.';

/** True when the backend may pull a deposit from `source`: the user's own Safe. */
export const isOwnSafe = (source?: string, safeAddress?: string): boolean =>
  !!source && !!safeAddress && source.toLowerCase() === safeAddress.toLowerCase();
