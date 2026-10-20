import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type Address, erc20Abi, parseUnits } from 'viem';
import { base } from 'viem/chains';
import { useBlockNumber, useReadContract } from 'wagmi';

import { useActivityActions } from '@/hooks/useActivityActions';
import { ADDRESSES, EXPO_PUBLIC_MINIMUM_EUR_DEPOSIT_AMOUNT } from '@/lib/config';
import {
  buildSoEurcDepositCalls,
  getSoEurcMinimumMint,
  readSoEurcDepositRate,
  SOEURC_DECIMALS,
} from '@/lib/deposit/soEurc';
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

const BASE_EXPLORER_URL = base.blockExplorers.default.url;

/**
 * EURC → soEURC from the Solid wallet (the Safe on Base).
 *
 * The Safe calls the soEURC teller itself, like the soFUSE deposit from the Solid
 * wallet: one user operation approving the vault for the amount and depositing
 * through the teller, which mints the shares straight to the Safe. Nothing goes
 * through the backend, so this works whether or not `/deposit` knows `eur` yet.
 */
const useDepositFromSolidEur = (
  tokenAddress: Address,
  token: string,
  minimumAmount: string = EXPO_PUBLIC_MINIMUM_EUR_DEPOSIT_AMOUNT,
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

  const isBaseChain = srcChainId === base.id;
  const isEurc = token === 'EURC';
  const safeAddress = user?.safeAddress as Address | undefined;

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: base.id,
    query: {
      enabled: isBaseChain && isEurc,
    },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [safeAddress as Address],
    chainId: base.id,
    query: {
      enabled: !!safeAddress && !!tokenAddress && isBaseChain && isEurc,
    },
  });

  const deposit = async (amount: string) => {
    if (!isBaseChain || !isEurc) return undefined;
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
      chainName: 'base',
      depositType: 'solid_wallet',
      depositMethod: 'eurc_solid_base',
      depositDestination: 'savings',
      isSponsor,
      operation: 'deposit_from_solid_eur',
    };

    let trackingId: string | undefined;
    let cancelled = false;

    try {
      await assertAccount();
      trackDepositInitiated(ctx);

      if (!safeAddress) {
        throw new Error('Solid wallet (Safe) address not found');
      }
      if (!isSponsor) {
        throw new Error(`Minimum deposit amount is ${minimumAmount} EURC`);
      }

      const amountWei = parseUnits(amount, SOEURC_DECIMALS);
      if (amountWei <= 0n || balance === undefined || amountWei > balance)
        throw new Error('Insufficient confirmed EURC balance');

      trackDepositValidated(ctx);

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      depositBreadcrumb('Starting EURC deposit from Solid wallet', {
        amount,
        safeAddress,
        srcChainId,
        token,
      });

      // Quote the shares at the teller's current rate and refuse to mint far fewer.
      const rate = await readSoEurcDepositRate();
      const minimumMint = getSoEurcMinimumMint(amountWei, rate);
      const transactions = buildSoEurcDepositCalls(amountWei, minimumMint);

      // A single activity up front, so there is only one entry in the UI.
      trackingId = await createActivity({
        title: `Deposit ${token}`,
        amount,
        symbol: token,
        chainId: base.id,
        fromAddress: safeAddress,
        toAddress: ADDRESSES.base.soEurcVault,
        type: TransactionType.DEPOSIT,
      });

      const smartAccountClient = await safeAA(base, user!.suborgId, user!.signWith);
      await assertAccount();
      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Deposit failed',
        base,
        userOpHash => {
          updateActivity(trackingId!, { userOpHash });
        },
        assertAccount,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        cancelled = true;
        updateActivity(trackingId, { status: TransactionStatus.CANCELLED });
        throw new Error('User cancelled transaction');
      }

      const txHash =
        result &&
        typeof result === 'object' &&
        result.transaction?.status === 'success' &&
        'transactionHash' in result
          ? (result as { transactionHash: `0x${string}` }).transactionHash
          : undefined;
      if (!txHash) throw new Error('EURC deposit has not been confirmed');

      // The teller minted in the same transaction: the deposit is complete.
      updateActivity(trackingId, {
        status: TransactionStatus.SUCCESS,
        hash: txHash,
        url: `${BASE_EXPLORER_URL}/tx/${txHash}`,
      });
      setHash(txHash);
      // An old account's receipt must never update the newly selected account: no
      // rewards refresh, no user update, and no success handed back to the form.
      // The deposit did complete for the account that made it, though, so this
      // hook's own status ends there instead of staying pending.
      if (
        selectedRewardsUserId() !== user!.userId ||
        useRewardsUpgradeStore.getState().session !== accountSession
      ) {
        setDepositStatus({ status: Status.SUCCESS });
        return undefined;
      }
      refreshRewardsAfterSavings(queryClient, user!.userId, safeAddress);
      updateUser({ ...user!, isDeposited: true });
      setDepositStatus({ status: Status.SUCCESS });

      depositBreadcrumb('EURC deposit from Solid wallet completed successfully', {
        amount,
        transactionHash: txHash,
        safeAddress,
      });
      trackDepositCompleted(ctx, { transactionHash: txHash });

      return trackingId;
    } catch (error: any) {
      console.error(error);
      const errMsg = captureDepositError(error, { ...ctx, depositStatus });

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
    refetchBalance();
  }, [blockNumber, refetchBalance]);

  return {
    balance,
    deposit,
    depositStatus,
    error,
    hash,
  };
};

export default useDepositFromSolidEur;
