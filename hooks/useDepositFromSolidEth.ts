import { useEffect, useState } from 'react';
import { type Address, encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { useBalance, useBlockNumber, useReadContract } from 'wagmi';

import { useActivityActions } from '@/hooks/useActivityActions';
import { createDeposit } from '@/lib/api';
import { ADDRESSES, EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS } from '@/lib/config';
import { buildDepositApproval } from '@/lib/deposit/allowance';
import {
  captureDepositError,
  depositBreadcrumb,
  DepositContext,
  trackDepositCompleted,
  trackDepositInitiated,
} from '@/lib/deposit/telemetry';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, StatusInfo, TransactionStatus, TransactionType, VaultType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { useUserStore } from '@/store/useUserStore';

import useUser from './useUser';

type DepositResult = {
  balance: bigint | undefined;
  deposit: (amount: string) => Promise<string | undefined>;
  depositStatus: StatusInfo;
  error: string | null;
  hash: Address | undefined;
};

const WETH_ABI = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

const useDepositFromSolidEth = (
  tokenAddress: Address,
  token: string,
  minimumAmount: string = '0.01',
): DepositResult => {
  const { user, safeAA } = useUser();
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const srcChainId = useDepositStore(state => state.srcChainId);
  const { createActivity, updateActivity } = useActivityActions();
  const updateUser = useUserStore(state => state.updateUser);

  const safeAddress = user?.safeAddress as Address | undefined;
  const isNativeEth = token === 'ETH';

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: srcChainId,
    query: {
      enabled: !!srcChainId,
    },
  });

  // ERC20 (WETH) balance
  const { data: erc20Balance, refetch: refetchErc20Balance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [safeAddress as Address],
    chainId: srcChainId,
    query: {
      enabled: !!safeAddress && !!srcChainId && !!tokenAddress && !isNativeEth,
    },
  });

  // Native ETH balance
  const { data: nativeBalanceData, refetch: refetchNativeBalance } = useBalance({
    address: safeAddress as `0x${string}` | undefined,
    chainId: mainnet.id,
    query: {
      enabled: !!safeAddress && !!srcChainId && isNativeEth,
    },
  });

  const balance = isNativeEth ? nativeBalanceData?.value : erc20Balance;

  const createEvent = async (amount: string, spender: Address, tokenSymbol: string) => {
    const clientTxId = await createActivity({
      title: `Deposit ${tokenSymbol}`,
      amount,
      symbol: tokenSymbol,
      chainId: srcChainId,
      fromAddress: safeAddress,
      toAddress: spender,
      type: TransactionType.DEPOSIT,
    });
    return clientTxId;
  };

  const deposit = async (amount: string) => {
    if (!token || !srcChainId) return undefined;

    const isSponsor = Number(amount) >= Number(minimumAmount);
    const ctx: DepositContext = {
      user,
      amount,
      chainId: srcChainId,
      chainName: 'ethereum',
      depositType: 'solid_wallet',
      depositMethod: 'eth_solid',
      depositDestination: 'savings',
      isSponsor,
      operation: 'deposit_from_solid_eth',
    };

    let trackingId: string | undefined;

    try {
      trackDepositInitiated(ctx);

      if (!safeAddress) {
        throw new Error('Solid wallet (Safe) address not found');
      }
      if (!isSponsor) {
        throw new Error(`Minimum deposit amount is ${minimumAmount} ETH`);
      }

      const spender = EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS as Address;

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      depositBreadcrumb('Starting ETH deposit from Solid wallet', {
        amount,
        safeAddress,
        srcChainId,
        token,
        isSponsor,
        isNativeEth,
      });

      const amountWei = parseUnits(amount, 18);

      const chain = mainnet;
      const smartAccountClient = await safeAA(chain, user!.suborgId, user!.signWith);

      // Build transactions: for native ETH, wrap first then approve WETH;
      // for WETH, just approve.
      const approvalToken = isNativeEth ? ADDRESSES.ethereum.weth : tokenAddress;
      const approveTransaction = await buildDepositApproval({
        tokenAddress: approvalToken,
        owner: safeAddress,
        spender,
        amount: amountWei,
        chainId: srcChainId,
      });

      const transactions: { to: Address; data: `0x${string}`; value: bigint }[] = isNativeEth
        ? [
            // Wrap ETH → WETH, then approve the wrapped balance.
            {
              to: ADDRESSES.ethereum.weth,
              data: encodeFunctionData({ abi: WETH_ABI, functionName: 'deposit' }),
              value: amountWei,
            },
            approveTransaction,
          ]
        : [approveTransaction];

      // Create activity for tracking
      trackingId = await createEvent(amount, spender, token);

      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        isNativeEth ? 'Wrap & Approve failed' : 'Approve failed',
        chain,
        userOpHash => {
          updateActivity(trackingId!, { userOpHash });
        },
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        updateActivity(trackingId, { status: TransactionStatus.CANCELLED });
        throw new Error('User cancelled transaction');
      }

      setDepositStatus({ status: Status.PENDING, message: 'Depositing' });

      if (result && typeof result === 'object' && 'transactionHash' in result) {
        const txHash = (result as { transactionHash: `0x${string}` }).transactionHash;
        setHash(txHash);
        updateActivity(trackingId, {
          status: TransactionStatus.PROCESSING,
          hash: txHash,
        });
      }

      // Call backend to pull tokens from Safe and deposit to vault
      const depositPromise = withRefreshToken(() =>
        createDeposit({
          eoaAddress: safeAddress,
          amount,
          trackingId,
          vault: VaultType.ETH,
        }),
      );

      depositPromise
        .then(result => {
          if (result?.transactionHash) {
            updateActivity(trackingId!, {
              status: TransactionStatus.PROCESSING,
            });
          }
          updateUser({ ...user!, isDeposited: true });
          setDepositStatus({ status: Status.SUCCESS });

          depositBreadcrumb('Deposit from Solid wallet (ETH) completed successfully', {
            amount,
            safeAddress,
            srcChainId,
            isSponsor,
          });

          trackDepositCompleted(ctx);
        })
        .catch(err => {
          console.error('Sponsored Solid ETH deposit failed:', err);
          updateActivity(trackingId!, {
            status: TransactionStatus.PROCESSING,
            metadata: { depositError: err?.message || 'Backend returned error' },
          });
          setDepositStatus({ status: Status.ERROR });
        });

      return trackingId;
    } catch (error: any) {
      console.error(error);
      const errMsg = captureDepositError(error, { ...ctx, depositStatus });

      if (trackingId) {
        updateActivity(trackingId, {
          status: TransactionStatus.FAILED,
          metadata: {
            error: error?.message || 'Unknown error',
            failedAt: new Date().toISOString(),
          },
        });
      }

      setDepositStatus({ status: Status.ERROR });
      setError(errMsg);
      throw error;
    }
  };

  useEffect(() => {
    if (isNativeEth) {
      refetchNativeBalance();
    } else {
      refetchErc20Balance();
    }
  }, [blockNumber, isNativeEth, refetchNativeBalance, refetchErc20Balance]);

  return {
    balance,
    deposit,
    depositStatus,
    error,
    hash,
  };
};

export default useDepositFromSolidEth;
