import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { createAccount } from '@turnkey/viem';
import {
  Address,
  createWalletClient,
  erc20Abi,
  hashTypedData,
  http,
} from 'viem';
import { mainnet } from 'viem/chains';

import { ADDRESSES } from '@/lib/config';
import { Status } from '@/lib/types';
import { publicClient, rpcUrls } from '@/lib/wagmi';

import useUser from './useUser';

type UseRescueTokenReturn = {
  rescue: (amountWei: bigint) => Promise<`0x${string}`>;
  status: Status;
  error: string | null;
  reset: () => void;
};

const useRescueToken = (): UseRescueTokenReturn => {
  const { user } = useUser();
  const { createHttpClient } = useTurnkey();
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus(Status.IDLE);
    setError(null);
  }, []);

  const rescue = useCallback(
    async (amountWei: bigint): Promise<`0x${string}`> => {
      if (!user?.walletAddress) throw new Error('Wallet address not found');
      if (!user?.safeAddress) throw new Error('Safe address not found');
      if (!user?.suborgId) throw new Error('Sub-organization not found');
      if (amountWei <= 0n) throw new Error('Amount must be greater than 0');

      try {
        setStatus(Status.PENDING);
        setError(null);

        const passkeyClient = createHttpClient({
          defaultStamperType: StamperType.Passkey,
        });

        const turnkeyAccount = await createAccount({
          client: passkeyClient,
          organizationId: user.suborgId,
          signWith: user.walletAddress,
        });

        // Same workaround as useUser.safeAA: route signTypedData through raw sign
        if (turnkeyAccount.sign) {
          const originalSign = turnkeyAccount.sign.bind(turnkeyAccount);
          turnkeyAccount.signTypedData = async (typedData: any) => {
            const hash = hashTypedData(typedData);
            return originalSign({ hash });
          };
        }

        const walletClient = createWalletClient({
          account: turnkeyAccount,
          chain: mainnet,
          transport: http(rpcUrls[mainnet.id]),
        });

        const txHash = await walletClient.writeContract({
          address: ADDRESSES.ethereum.usdc,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [user.safeAddress as Address, amountWei],
        });

        const receipt = await publicClient(mainnet.id).waitForTransactionReceipt({
          hash: txHash,
        });

        if (receipt.status !== 'success') {
          throw new Error('Rescue transaction reverted on-chain');
        }

        setStatus(Status.SUCCESS);
        return txHash;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to rescue tokens';
        Sentry.captureException(err, {
          tags: { type: 'rescue_token_error' },
          extra: {
            amountWei: amountWei.toString(),
            walletAddress: user.walletAddress,
            safeAddress: user.safeAddress,
          },
          user: { id: user.userId, address: user.safeAddress },
        });
        setStatus(Status.ERROR);
        setError(message);
        throw err;
      }
    },
    [createHttpClient, user],
  );

  return { rescue, status, error, reset };
};

export default useRescueToken;
