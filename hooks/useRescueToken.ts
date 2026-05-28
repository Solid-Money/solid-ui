import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { createAccount } from '@turnkey/viem';
import {
  Address,
  createWalletClient,
  erc20Abi,
  formatUnits,
  hashTypedData,
  http,
} from 'viem';
import { mainnet } from 'viem/chains';

import { ADDRESSES } from '@/lib/config';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { publicClient, rpcUrls } from '@/lib/wagmi';

import { useActivityActions } from './useActivityActions';
import useUser from './useUser';

const USDC_DECIMALS = 6;
const RESCUE_CHAIN_ID = mainnet.id;
const RESCUE_EXPLORER = 'https://etherscan.io';

type RescueResult = {
  transactionHash: `0x${string}`;
  clientTxId: string;
};

type UseRescueTokenReturn = {
  rescue: (amountWei: bigint) => Promise<RescueResult>;
  status: Status;
  error: string | null;
  reset: () => void;
};

const useRescueToken = (): UseRescueTokenReturn => {
  const { user } = useUser();
  const { createHttpClient } = useTurnkey();
  const { createActivity, updateActivity } = useActivityActions();
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus(Status.IDLE);
    setError(null);
  }, []);

  const rescue = useCallback(
    async (amountWei: bigint): Promise<RescueResult> => {
      if (!user?.walletAddress) throw new Error('Wallet address not found');
      if (!user?.safeAddress) throw new Error('Safe address not found');
      if (!user?.suborgId) throw new Error('Sub-organization not found');
      if (amountWei <= 0n) throw new Error('Amount must be greater than 0');

      const amount = formatUnits(amountWei, USDC_DECIMALS);

      const clientTxId = await createActivity({
        type: TransactionType.RESCUE_TOKEN,
        title: `Rescue ${amount} USDC`,
        shortTitle: 'Rescue',
        amount,
        symbol: 'USDC',
        chainId: RESCUE_CHAIN_ID,
        fromAddress: user.walletAddress,
        toAddress: user.safeAddress,
        status: TransactionStatus.PENDING,
        metadata: {
          description: `Rescue ${amount} USDC from signer wallet to Solid wallet`,
          tokenAddress: ADDRESSES.ethereum.usdc,
          tokenDecimals: USDC_DECIMALS.toString(),
        },
      });

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
          transport: http(rpcUrls[RESCUE_CHAIN_ID]),
        });

        const txHash = await walletClient.writeContract({
          address: ADDRESSES.ethereum.usdc,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [user.safeAddress as Address, amountWei],
        });

        await updateActivity(clientTxId, {
          status: TransactionStatus.PROCESSING,
          hash: txHash,
          url: `${RESCUE_EXPLORER}/tx/${txHash}`,
          metadata: { submittedAt: new Date().toISOString() },
        });

        const receipt = await publicClient(RESCUE_CHAIN_ID).waitForTransactionReceipt({
          hash: txHash,
        });

        if (receipt.status !== 'success') {
          await updateActivity(clientTxId, {
            status: TransactionStatus.FAILED,
            hash: txHash,
            url: `${RESCUE_EXPLORER}/tx/${txHash}`,
            metadata: {
              error: 'Transaction reverted on-chain',
              failedAt: new Date().toISOString(),
            },
          });
          throw new Error('Rescue transaction reverted on-chain');
        }

        await updateActivity(clientTxId, {
          status: TransactionStatus.SUCCESS,
          hash: txHash,
          url: `${RESCUE_EXPLORER}/tx/${txHash}`,
          metadata: { confirmedAt: new Date().toISOString() },
        });

        setStatus(Status.SUCCESS);
        return { transactionHash: txHash, clientTxId };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to rescue tokens';

        await updateActivity(clientTxId, {
          status: TransactionStatus.FAILED,
          metadata: {
            error: message,
            failedAt: new Date().toISOString(),
          },
        });

        Sentry.captureException(err, {
          tags: { type: 'rescue_token_error' },
          extra: {
            amountWei: amountWei.toString(),
            walletAddress: user.walletAddress,
            safeAddress: user.safeAddress,
            clientTxId,
          },
          user: { id: user.userId, address: user.safeAddress },
        });
        setStatus(Status.ERROR);
        setError(message);
        throw err;
      }
    },
    [createActivity, updateActivity, createHttpClient, user],
  );

  return { rescue, status, error, reset };
};

export default useRescueToken;
