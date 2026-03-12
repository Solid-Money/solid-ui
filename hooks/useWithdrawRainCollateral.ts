import { useCallback, useState } from 'react';
import {
  Address,
  encodeFunctionData,
  encodeAbiParameters,
  encodePacked,
  Hex,
  TransactionReceipt,
  hashTypedData,
  keccak256,
  toHex,
} from 'viem';
import { readContract } from 'viem/actions';
import * as Sentry from '@sentry/react-native';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { createAccount } from '@turnkey/viem';

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

// Safe v1.4.1 constants for ERC-1271 signature wrapping
// keccak256("EIP712Domain(uint256 chainId,address verifyingContract)")
const SAFE_DOMAIN_SEPARATOR_TYPEHASH =
  '0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218' as Hex;
// keccak256("SafeMessage(bytes message)")
const SAFE_MSG_TYPEHASH =
  '0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca' as Hex;

/**
 * Compute the hash that Safe v1.4.1's isValidSignature expects the owner to sign.
 *
 * Safe's CompatibilityFallbackHandler.isValidSignature(bytes32 _dataHash, bytes _signature):
 *   1. message = abi.encode(_dataHash)
 *   2. safeMessageHash = keccak256(abi.encode(SAFE_MSG_TYPEHASH, keccak256(message)))
 *   3. messageHash = keccak256(0x19 || 0x01 || domainSeparator || safeMessageHash)
 *   4. checkSignatures(messageHash, ...) → ecrecover(messageHash, v, r, s)
 *
 * The owner (Turnkey EOA) must sign `messageHash` for the Safe to validate it.
 */
function computeSafeMessageHash(
  safeAddress: Address,
  chainId: number,
  dataHash: Hex,
): Hex {
  // Safe domain separator: keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, chainId, safeAddress))
  const domainSeparator = keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }],
      [SAFE_DOMAIN_SEPARATOR_TYPEHASH, BigInt(chainId), safeAddress],
    ),
  );

  // message = abi.encode(dataHash)
  const message = encodeAbiParameters([{ type: 'bytes32' }], [dataHash]);

  // safeMessageHash = keccak256(abi.encode(SAFE_MSG_TYPEHASH, keccak256(message)))
  const safeMessageStructHash = keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes32' }],
      [SAFE_MSG_TYPEHASH, keccak256(message)],
    ),
  );

  // EIP-712 hash: keccak256(0x19 || 0x01 || domainSeparator || safeMessageStructHash)
  return keccak256(
    encodePacked(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      ['0x19', '0x01', domainSeparator, safeMessageStructHash],
    ),
  );
}

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
  const { user, safeAA } = useUser();
  const { createHttpClient } = useTurnkey();
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

        // Step 1: Get withdrawal signature data from backend (Rain executor signature)
        const sigData: WithdrawCollateralSignatureResponse = await withdrawCardCollateral({
          amount: params.amount,
          recipientAddress: params.recipientAddress,
          adminAddress: user.safeAddress,
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

        // Step 3: Create Turnkey passkey signer for admin EIP-712 signature
        const passkeyClient = createHttpClient({
          defaultStamperType: StamperType.Passkey,
        });
        const turnkeyAccount = await createAccount({
          client: passkeyClient,
          organizationId: user.suborgId,
          signWith: user.signWith,
        });

        // Step 4: Generate admin EIP-712 signature wrapped for Safe ERC-1271
        //
        // Rain's coordinator calls SignatureChecker.isValidSignatureNow(safeAddress, rainDigest, sig)
        // → Safe's isValidSignature(rainDigest, sig) wraps rainDigest in Safe's message format
        // → checkSignatures(safeMessageHash, ...) does ecrecover(safeMessageHash, v, r, s)
        //
        // So the Turnkey EOA must sign the Safe-wrapped message hash, NOT the raw Rain digest.
        const adminSalt = toHex(crypto.getRandomValues(new Uint8Array(32)));

        // 4a. Compute Rain's EIP-712 digest (the hash Rain's coordinator will pass to isValidSignature)
        const rainDigest = hashTypedData({
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
          primaryType: 'Withdraw',
          message: {
            user: user.safeAddress as Address,
            asset: sigData.assetAddress as Address,
            amount: BigInt(sigData.amount),
            recipient: sigData.recipient as Address,
            nonce: nonce,
          },
        });

        // 4b. Compute Safe v1.4.1's wrapped message hash (what the EOA owner actually signs)
        const safeMessageHash = computeSafeMessageHash(
          user.safeAddress as Address,
          sigData.chainId,
          rainDigest,
        );

        // 4c. Sign the Safe-wrapped hash with Turnkey EOA (raw hash signing, no EIP-712 re-wrapping)
        const adminSignature = await turnkeyAccount.sign({ hash: safeMessageHash });

        // Step 5: Build the withdrawAsset call and execute via Safe smart account
        const smartAccountClient = await safeAA(chain, user.suborgId, user.signWith);

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
    [user, safeAA, createHttpClient, trackTransaction],
  );

  return { withdrawCollateral, status, error };
};

export default useWithdrawRainCollateral;
