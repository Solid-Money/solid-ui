import { useCallback } from 'react';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { createAccount } from '@turnkey/viem';

import useUser from '@/hooks/useUser';

/**
 * Signs an arbitrary message with the user's Turnkey signer EOA
 * (`user.walletAddress`) — not the Safe smart account.
 *
 * The key lives in Turnkey behind the user's passkey, so signing raises a
 * biometric/passkey prompt. Where a provider requires proof that the human
 * authorised an action, that prompt IS the confirmation, which is why this is a
 * client-side signature and not something the backend can produce.
 *
 * Building the account does not prompt; only signing does.
 */
export function useWalletMessageSigner() {
  const { user } = useUser();
  const { createHttpClient } = useTurnkey();

  // `walletAddress` is optional on the stored user and the signup path never wrote
  // it, so rows persisted by a signup that was never followed by a fresh login
  // carry only `signWith`. Both are assigned the same EOA by the backend, and
  // `signWith` is required — so it is the safer of the two to key off, and reading
  // it heals those rows without forcing the user to log out and back in.
  const signerAddress = user?.walletAddress ?? user?.signWith;

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!signerAddress || !user?.suborgId) {
        throw new Error('Wallet is not ready yet');
      }

      const passkeyClient = createHttpClient({ defaultStamperType: StamperType.Passkey });
      const turnkeyAccount = await createAccount({
        client: passkeyClient,
        organizationId: user.suborgId,
        signWith: signerAddress,
      });

      return turnkeyAccount.signMessage({ message });
    },
    [createHttpClient, signerAddress, user?.suborgId],
  );

  return {
    signMessage,
    /** Whether a signature can be attempted at all. */
    canSign: Boolean(signerAddress && user?.suborgId),
    /** The EOA that will sign — the address a provider verifies against. */
    walletAddress: signerAddress,
  };
}
