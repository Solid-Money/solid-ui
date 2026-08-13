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

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!user?.walletAddress || !user?.suborgId) {
        throw new Error('Wallet is not ready yet');
      }

      const passkeyClient = createHttpClient({ defaultStamperType: StamperType.Passkey });
      const turnkeyAccount = await createAccount({
        client: passkeyClient,
        organizationId: user.suborgId,
        signWith: user.walletAddress,
      });

      return turnkeyAccount.signMessage({ message });
    },
    [createHttpClient, user?.walletAddress, user?.suborgId],
  );

  return {
    signMessage,
    /** Whether a signature can be attempted at all. */
    canSign: Boolean(user?.walletAddress && user?.suborgId),
    /** The EOA that will sign — the address a provider verifies against. */
    walletAddress: user?.walletAddress,
  };
}
