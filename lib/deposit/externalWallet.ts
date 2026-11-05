import { createWalletLinkChallenge, getLinkedWallets, linkWallet } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

import type { Account } from 'thirdweb/wallets';

/**
 * The backend pulls a connected-wallet deposit only from the user's own Safe or
 * from a wallet linked to their account by signature (solid-backend #2180 and
 * linked wallets). Before that it pulled from whatever address the request
 * named, so any signed-in user could take the funds another wallet had approved.
 */

/** True when `source` is the user's own Safe, which needs no link. */
export const isOwnSafe = (source?: string, safeAddress?: string): boolean =>
  !!source && !!safeAddress && source.toLowerCase() === safeAddress.toLowerCase();

/**
 * Makes sure the backend will pull a deposit from this connected wallet: if it
 * isn't linked to the user's account yet, the server issues a one-time message,
 * the wallet signs it, and the server checks the signature. One signature per
 * wallet, the first time it deposits; nothing on later deposits.
 *
 * `onSignRequest` runs just before the wallet is asked to sign, so the caller
 * can say why a prompt is about to appear.
 */
export const ensureWalletLinked = async (
  account: Account | undefined,
  safeAddress: string | undefined,
  { onSignRequest }: { onSignRequest?: () => void } = {},
): Promise<void> => {
  if (!account) throw new Error('EOA not connected');
  if (isOwnSafe(account.address, safeAddress)) return;

  const address = account.address.toLowerCase();
  const linked = await withRefreshToken(() => getLinkedWallets());
  if (linked?.some(wallet => wallet.address.toLowerCase() === address)) return;

  const { message } = await withRefreshToken(() => createWalletLinkChallenge(account.address));
  onSignRequest?.();
  const signature = await account.signMessage({ message });
  await withRefreshToken(() => linkWallet(account.address, signature));
};
