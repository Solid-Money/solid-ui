import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type Address, encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { fuse } from 'viem/chains';
import { useBalance, useBlockNumber, useReadContract } from 'wagmi';

import { WRAPPED_FUSE } from '@/constants/addresses';
import { useActivityActions } from '@/hooks/useActivityActions';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { ADDRESSES, EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS } from '@/lib/config';
import {
  captureDepositError,
  depositBreadcrumb,
  DepositContext,
  trackDepositCompleted,
  trackDepositInitiated,
  trackDepositValidated,
} from '@/lib/deposit/telemetry';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { refreshRewardsAfterSavings } from '@/lib/refreshRewardsAfterSavings';
import { Status, StatusInfo, TransactionStatus, TransactionType } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserStore } from '@/store/useUserStore';

import useUser from './useUser';

type DepositResult = {
  balance: bigint | undefined;
  deposit: (amount: string) => Promise<string | undefined>;
  depositStatus: StatusInfo;
  error: string | null;
  hash: Address | undefined;
};

const useDepositFromSolidFuse = (
  tokenAddress: Address,
  token: string,
  minimumAmount: string = '100',
): DepositResult => {
  const { user, safeAA } = useUser();
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const srcChainId = useDepositStore(state => state.srcChainId);
  const { createActivity, updateActivity } = useActivityActions();
  const updateUser = useUserStore(state => state.updateUser);

  const isFuseChain = srcChainId === fuse.id;
  const isNativeFuse = token === 'FUSE';
  const safeAddress = user?.safeAddress as Address | undefined;

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: fuse.id,
    query: {
      enabled: isFuseChain,
    },
  });

  const { data: erc20Balance, refetch: refetchErc20Balance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [safeAddress as Address],
    chainId: fuse.id,
    query: {
      enabled: !!safeAddress && isFuseChain && !isNativeFuse,
    },
  });

  const { data: nativeBalanceData, refetch: refetchNativeBalance } = useBalance({
    address: safeAddress as `0x${string}` | undefined,
    chainId: fuse.id,
    query: {
      enabled: !!safeAddress && isFuseChain && isNativeFuse,
    },
  });

  const balance = isNativeFuse ? nativeBalanceData?.value : erc20Balance;

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
    if (!isFuseChain || (token !== 'WFUSE' && token !== 'FUSE')) return undefined;
    if (inFlight.current) return undefined;
    inFlight.current = true;
    const accountSession = useRewardsUpgradeStore.getState().session;
    const assertAccount = async () => {
      if (
        !user?.userId ||
        selectedRewardsUserId() !== user.userId ||
        useRewardsUpgradeStore.getState().session !== accountSession
      )
        throw new Error('Account changed. Reopen the deposit for the selected account.');
    };

    const isSponsor = Number(amount) >= Number(minimumAmount);
    const ctx: DepositContext = {
      user,
      amount,
      chainId: srcChainId,
      chainName: 'fuse',
      depositType: 'solid_wallet',
      depositMethod: 'fuse_solid',
      depositDestination: 'savings',
      isSponsor,
      operation: 'deposit_from_solid_fuse',
    };

    let trackingId: string | undefined;
    let cancelled = false;

    try {
      await assertAccount();
      trackDepositInitiated(ctx);

      if (!safeAddress) {
        throw new Error('Solid wallet (Safe) address not found');
      }

      const spender = EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS as Address;

      trackDepositValidated(ctx);

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      depositBreadcrumb('Starting deposit from Solid wallet', {
        amount,
        safeAddress,
        srcChainId,
        token,
        isSponsor,
      });

      const amountWei = parseUnits(amount, 18);
      if (amountWei <= 0n || balance === undefined || amountWei > balance)
        throw new Error('Insufficient confirmed FUSE balance');

      let transactions: { to: Address; data?: `0x${string}`; value?: bigint }[];

      if (token === 'FUSE') {
        const callData = encodeFunctionData({
          abi: ETHEREUM_TELLER_ABI,
          functionName: 'deposit',
          args: [ADDRESSES.fuse.nativeFeeToken, amountWei, BigInt(0)],
        });
        transactions = [
          {
            to: ADDRESSES.fuse.fuseTeller,
            data: callData,
            value: amountWei,
          },
        ];
      } else {
        const callData = encodeFunctionData({
          abi: ETHEREUM_TELLER_ABI,
          functionName: 'deposit',
          args: [WRAPPED_FUSE, amountWei, BigInt(0)],
        });
        transactions = [
          {
            to: WRAPPED_FUSE,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [ADDRESSES.fuse.fuseVault, amountWei],
            }),
          },
          {
            to: ADDRESSES.fuse.fuseTeller,
            data: callData,
            value: 0n,
          },
        ];
      }

      let txHash: `0x${string}` | undefined;

      if (!isSponsor) {
        throw new Error(`Minimum deposit amount is ${minimumAmount} for Fuse deposits`);
      }

      // Create a SINGLE activity up front so there is only one entry in the UI.
      trackingId = await createEvent(amount, spender, token);

      if (transactions.length > 0) {
        const smartAccountClient = await safeAA(fuse, user!.suborgId, user!.signWith);
        await assertAccount();
        const result = await executeTransactions(
          smartAccountClient,
          transactions,
          'Deposit failed',
          fuse,
          userOpHash => {
            // Update the existing activity with the userOpHash (do NOT create a new one)
            updateActivity(trackingId!, {
              userOpHash,
            });
          },
          assertAccount,
        );

        if (result === USER_CANCELLED_TRANSACTION) {
          cancelled = true;
          // Mark the pre-created activity as cancelled
          updateActivity(trackingId, {
            status: TransactionStatus.CANCELLED,
          });
          throw new Error('User cancelled transaction');
        }

        if (
          result &&
          typeof result === 'object' &&
          result.transaction?.status === 'success' &&
          'transactionHash' in result
        ) {
          txHash = (result as { transactionHash: `0x${string}` }).transactionHash;
          // Update the activity with the on-chain transaction hash
          updateActivity(trackingId, {
            status: TransactionStatus.PROCESSING,
            hash: txHash,
          });
        }
      }

      if (!txHash) throw new Error('FUSE deposit has not been confirmed');
      setHash(txHash);
      // An old account's receipt must never update the newly selected account.
      if (
        selectedRewardsUserId() !== user!.userId ||
        useRewardsUpgradeStore.getState().session !== accountSession
      )
        return undefined;
      refreshRewardsAfterSavings(queryClient, user!.userId, safeAddress);

      // On-chain deposit is complete — mark as success directly.
      // No backend createDeposit() call needed since the Safe already
      // deposited to the vault on-chain.
      updateUser({ ...user!, isDeposited: true });
      setDepositStatus({ status: Status.SUCCESS });

      depositBreadcrumb('Deposit from Solid wallet completed successfully', {
        amount,
        transactionHash: txHash,
        safeAddress,
        srcChainId,
        isSponsor,
      });

      trackDepositCompleted(ctx, { transactionHash: txHash });

      return trackingId;
    } catch (error: any) {
      console.error(error);
      const errMsg = captureDepositError(error, { ...ctx, depositStatus });

      // Mark activity as FAILED so it doesn't stay stuck in PENDING
      if (trackingId) {
        updateActivity(trackingId, {
          status: cancelled ? TransactionStatus.CANCELLED : TransactionStatus.FAILED,
          metadata: {
            error: error?.message || 'Unknown error',
            failedAt: new Date().toISOString(),
          },
        });
      }

      setDepositStatus({ status: Status.ERROR });
      setError(errMsg);
      throw error;
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    if (isNativeFuse) {
      refetchNativeBalance();
    } else {
      refetchErc20Balance();
    }
  }, [blockNumber, isNativeFuse, refetchNativeBalance, refetchErc20Balance]);

  return {
    balance,
    deposit,
    depositStatus,
    error,
    hash,
  };
};

export default useDepositFromSolidFuse;
