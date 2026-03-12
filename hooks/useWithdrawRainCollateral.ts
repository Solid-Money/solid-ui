import { useCallback, useState } from 'react';
import { Address, encodeFunctionData, Hex, TransactionReceipt, toHex } from 'viem';
import { readContract } from 'viem/actions';
import * as Sentry from '@sentry/react-native';

import { withdrawCardCollateral } from '@/lib/api';
import { Status, TransactionType, WithdrawCollateralSignatureResponse } from '@/lib/types';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { publicClient, getChain } from '@/lib/wagmi';
import useUser from './useUser';
import { useActivityActions } from '@/hooks/useActivityActions';

const RAIN_COORDINATOR_V2_ABI = [
  {
    inputs: [
      { name: 'collateralProxy', type: 'address' },
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'expiresAt', type: 'uint256' },
      { name: 'executorPublisherSalt', type: 'bytes' },
      { name: 'executorPublisherSig', type: 'bytes' },
      { name: 'adminSalts', type: 'bytes[]' },
      { name: 'adminSigs', type: 'bytes[]' },
      { name: 'directTransfer', type: 'bool' },
    ],
    name: 'withdrawAsset',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const RAIN_COLLATERAL_V2_ABI = [
  {
    inputs: [],
    name: 'adminNonce',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

type WithdrawRainCollateralResult = {
  withdrawCollateral: (params: {
    amount: string;
    recipientAddress: string;
    chainId?: number;
    tokenAddress?: string;
  }) => Promise<TransactionReceipt>;
  status: Status;
  error: string | null;
};

const useWithdrawRainCollateral = (): WithdrawRainCollateralResult => {
  const { user, safeAA, createTurnkeySigner } = useUser();
  const { trackTransaction } = useActivityActions();
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const withdrawCollateral = useCallback(
    async (params: {
      amount: string;
      recipientAddress: string;
      chainId?: number;
      tokenAddress?: string;
    }) => {
      try {
        if (!user?.safeAddress || !user?.suborgId || !user?.signWith) {
          throw new Error('User wallet not configured');
        }

        setStatus(Status.PENDING);
        setError(null);

        // Create a Turnkey EOA signer for direct EIP-712 signing.
        // Rain's V2 coordinator verifies admin signatures using ecrecover, which requires
        // a standard EOA signature. The Safe's signTypedData wraps hashes in a SafeMessage
        // envelope (ERC-1271), producing signatures that ecrecover cannot resolve to the
        // admin address. We sign directly with the Turnkey EOA and use its address as the
        // adminAddress sent to Rain.
        const turnkeySigner = await createTurnkeySigner(user.suborgId, user.signWith);
        const adminAddress = turnkeySigner.address;

        // Step 1: Get withdrawal signature data from backend (Rain executor signature)
        const sigData: WithdrawCollateralSignatureResponse = await withdrawCardCollateral({
          amount: params.amount,
          recipientAddress: params.recipientAddress,
          adminAddress,
          ...(params.chainId != null && { chainId: params.chainId }),
          ...(params.tokenAddress && { tokenAddress: params.tokenAddress }),
        });

        const chain = getChain(sigData.chainId);
        if (!chain) {
          throw new Error(`Chain ${sigData.chainId} is not configured`);
        }

        const client = publicClient(sigData.chainId);

        // Step 2: Get admin nonce from collateral contract
        const nonce = await readContract(client, {
          address: sigData.collateralProxy as Address,
          abi: RAIN_COLLATERAL_V2_ABI,
          functionName: 'adminNonce',
        });

        // Step 3: Create Safe smart account client for transaction execution
        const smartAccountClient = await safeAA(chain, user.suborgId, user.signWith);

        // Step 4: Generate admin EIP-712 signature with Turnkey EOA
        const adminSalt = toHex(crypto.getRandomValues(new Uint8Array(32)));

        const adminSignature = await turnkeySigner.signTypedData({
          domain: {
            name: 'Collateral',
            version: '2',
            chainId: sigData.chainId,
            verifyingContract: sigData.collateralProxy as Address,
            salt: adminSalt as Hex,
          },
          types: {
            Withdraw: [
              { name: 'user', type: 'address' },
              { name: 'asset', type: 'address' },
              { name: 'amount', type: 'uint256' },
              { name: 'recipient', type: 'address' },
              { name: 'nonce', type: 'uint256' },
            ],
          },
          primaryType: 'Withdraw' as const,
          message: {
            user: adminAddress as Address,
            asset: sigData.assetAddress as Address,
            amount: BigInt(sigData.amount),
            recipient: sigData.recipient as Address,
            nonce: nonce,
          },
        });

        // Step 5: Build the withdrawAsset call and execute via Safe smart account
        const withdrawCalldata = encodeFunctionData({
          abi: RAIN_COORDINATOR_V2_ABI,
          functionName: 'withdrawAsset',
          args: [
            sigData.collateralProxy as Address,
            sigData.assetAddress as Address,
            BigInt(sigData.amount),
            sigData.recipient as Address,
            BigInt(sigData.expiresAt),
            sigData.executorPublisherSalt as Hex,
            sigData.executorPublisherSig as Hex,
            [adminSalt as Hex],
            [adminSignature],
            true, // directTransfer
          ],
        });

        const transactions = [
          {
            to: sigData.coordinatorAddress as Address,
            data: withdrawCalldata,
            value: 0n,
          },
        ];

        Sentry.addBreadcrumb({
          message: 'Starting Rain collateral withdrawal',
          category: 'collateral',
          data: {
            amount: params.amount,
            userAddress: user.safeAddress,
            chainId: sigData.chainId,
            collateralProxy: sigData.collateralProxy,
          },
        });

        const result = await trackTransaction(
          {
            type: TransactionType.WITHDRAW_COLLATERAL,
            title: 'Withdraw collateral',
            shortTitle: 'Withdraw collateral',
            amount: params.amount,
            symbol: 'USDC',
            chainId: sigData.chainId,
            fromAddress: user.safeAddress,
            toAddress: sigData.coordinatorAddress,
            metadata: {
              description: `Withdraw ${params.amount} collateral from Rain contract`,
              collateralProxy: sigData.collateralProxy,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Rain collateral withdrawal failed',
              chain,
              onUserOpHash,
            ),
        );

        const transaction_result =
          result && typeof result === 'object' && 'transaction' in result
            ? result.transaction
            : result;

        if (transaction_result === USER_CANCELLED_TRANSACTION) {
          throw new Error('User cancelled transaction');
        }

        setStatus(Status.SUCCESS);
        return transaction_result;
      } catch (err) {
        console.error('Rain collateral withdrawal error:', err);

        Sentry.captureException(err, {
          tags: { operation: 'withdraw_rain_collateral' },
          extra: {
            amount: params.amount,
            recipientAddress: params.recipientAddress,
            userAddress: user?.safeAddress,
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
          },
          user: {
            id: user?.userId,
            address: user?.safeAddress,
          },
        });

        setStatus(Status.ERROR);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      }
    },
    [user, safeAA, createTurnkeySigner, trackTransaction],
  );

  return { withdrawCollateral, status, error };
};

export default useWithdrawRainCollateral;
