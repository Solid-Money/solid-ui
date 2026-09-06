import { useCallback, useState } from 'react';

import { useWalletMessageSigner } from '@/hooks/useWalletMessageSigner';
import { useCompleteWirexWalletLink, useInitWirexWalletLink } from '@/hooks/useWirexBankAccounts';
import { WirexBankRailStatusDto } from '@/lib/types/wirex-bank';

/**
 * Wirex's wallet-linked SEPA activation: challenge → sign → complete.
 *
 * The second of two activation paths. It applies only when the `SepaAccount`
 * capability reports `ExternalProviderVerificationRequired`; Wirex rejects it
 * with a 400 in every other state, and rejects the plain activation call in
 * this one — so the capability, not the client, chooses.
 *
 * The signature comes from the user's Turnkey signer EOA, which is the address
 * the backend registered as their Wirex `user_address`. Wirex resolves the
 * wallet it will verify against on its own side and names it in the challenge
 * response, so that address is checked against the signer before a passkey
 * prompt is raised: signing with the wrong key would burn the challenge and
 * return a signature error that says nothing about the real cause.
 */
export function useWirexWalletLink() {
  const initLink = useInitWirexWalletLink();
  const completeLink = useCompleteWirexWalletLink();
  const { signMessage, canSign, walletAddress } = useWalletMessageSigner();
  const [error, setError] = useState<string | null>(null);

  const link = useCallback(async (): Promise<WirexBankRailStatusDto | null> => {
    setError(null);

    if (!canSign) {
      setError('Your wallet is not ready yet. Try again in a moment.');
      return null;
    }

    try {
      const challenge = await initLink.mutateAsync();
      if (!challenge) throw new Error('No challenge returned');

      // Addresses are case-insensitive hex; Wirex returns EIP-55 checksummed
      // and our stored value may not be, so compare lower-cased.
      if (
        walletAddress &&
        challenge.walletAddress &&
        challenge.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
      ) {
        setError('This account is linked to a different wallet. Please contact support.');
        return null;
      }

      // Raises the passkey prompt. That prompt IS the user's authorisation —
      // it is why this signature cannot be produced server-side.
      const signature = await signMessage(challenge.challenge);

      const rail = await completeLink.mutateAsync(signature);
      return rail ?? null;
    } catch (caught) {
      setError(await describeLinkFailure(caught));
      return null;
    }
  }, [canSign, completeLink, initLink, signMessage, walletAddress]);

  return {
    link,
    error,
    isLinking: initLink.isPending || completeLink.isPending,
    /** Clear a previous failure, e.g. when the user reopens the screen. */
    reset: useCallback(() => setError(null), []),
  };
}

/**
 * Turn a failure into something the user can act on.
 *
 * A rejected signature is terminal for that challenge — the backend says so,
 * and the fix is to start over rather than retry the same one, so the message
 * has to convey that.
 */
async function describeLinkFailure(error: unknown): Promise<string> {
  if (error instanceof Response) {
    try {
      const body: unknown = await error.json();
      const message = (body as { message?: unknown })?.message;
      if (typeof message === 'string' && message) return message;
      if (Array.isArray(message) && typeof message[0] === 'string') {
        return message[0];
      }
    } catch {
      // Non-JSON body; fall through to the generic message.
    }
  }
  // A cancelled passkey prompt lands here — the user knows what they did, so
  // the message only needs to say the step did not complete.
  return 'Wallet verification did not complete. Please try again.';
}
