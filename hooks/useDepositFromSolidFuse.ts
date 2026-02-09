import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { type Address, erc20Abi, encodeFunctionData, parseUnits } from 'viem';
import { fuse } from 'viem/chains';
import { useBalance, useBlockNumber, useReadContract } from 'wagmi';

import { ERRORS } from '@/constants/errors';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivity } from '@/hooks/useActivity';
import { track, trackIdentity } from '@/lib/analytics';
import { createDeposit } from '@/lib/api';
import { getAttributionChannel } from '@/lib/attribution';
import {
  EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS,
  EXPO_PUBLIC_FUSE_GAS_RESERVE,
  EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT,
} from '@/lib/config';
import { Status, StatusInfo, TransactionType, VaultType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { getTokenAllowance } from '@/lib/utils/contract';
import { useAttributionStore } from '@/store/useAttributionStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useUserStore } from '@/store/useUserStore';

import useUser from './useUser';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';

type DepositResult = {
  balance: bigint | undefined;
  deposit: (amount: string) => Promise<string | undefined>;
  depositStatus: StatusInfo;
  error: string | null;
  hash: Address | undefined;
};

const useDepositFromSolidFuse = (tokenAddress: Address, token: string): DepositResult => {
  const { user, safeAA } = useUser();
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const updateUser = useUserStore(state => state.updateUser);
  const srcChainId = useDepositStore(state => state.srcChainId);
  const { createActivity, trackTransaction } = useActivity();

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
      title: `Deposited ${tokenSymbol}`,
      amount,
      symbol: 'soFUSE',
      chainId: srcChainId,
      fromAddress: safeAddress,
      toAddress: spender,
      type: TransactionType.DEPOSIT,
    });
    return clientTxId;
  };

  const deposit = async (amount: string) => {
    if (!isFuseChain || (token !== 'WFUSE' && token !== 'FUSE')) return undefined;

    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);
    let trackingId: string | undefined;

    try {
      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        amount,
        deposit_type: 'solid_wallet',
        deposit_method: 'fuse_solid',
        chain_id: srcChainId,
        chain_name: 'fuse',
        is_sponsor: Number(amount) >= Number(EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT),
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      if (!safeAddress) {
        const err = new Error('Solid wallet (Safe) address not found');
        Sentry.captureException(err, {
          tags: { operation: 'deposit_from_solid_fuse', step: 'validation', reason: 'no_safe_address' },
          extra: { amount, srcChainId, hasUser: !!user },
        });
        throw err;
      }

      const isSponsor = Number(amount) >= Number(EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT);
      const spender = EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS as Address;

      track(TRACKING_EVENTS.DEPOSIT_VALIDATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        amount,
        is_sponsor: isSponsor,
        chain_id: srcChainId,
        deposit_type: 'solid_wallet',
      });

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      Sentry.addBreadcrumb({
        message: 'Starting deposit from Solid wallet',
        category: 'deposit',
        data: { amount, safeAddress, srcChainId, token, isSponsor },
      });

      const amountWei = parseUnits(amount, 18);

      let transactions: { to: Address; data?: `0x${string}`; value?: bigint }[];

      if (token === 'FUSE') {
        const depositValueWei = parseUnits(
          (Number(amount) - Number(EXPO_PUBLIC_FUSE_GAS_RESERVE)).toString(),
          18,
        );
        transactions = [
          {
            to: spender,
            value: depositValueWei,
            data: '0x' as `0x${string}`,
          },
        ];
      } else {
        const allowance = await getTokenAllowance(
          tokenAddress,
          safeAddress,
          spender,
          fuse.id,
        );
        transactions =
          allowance >= amountWei
            ? []
            : [
                {
                  to: tokenAddress,
                  data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [spender, amountWei],
                  }),
                  value: 0n,
                },
              ];
      }

      let txHash: `0x${string}` | undefined;

      if (transactions.length > 0) {
        const smartAccountClient = await safeAA(fuse, user!.suborgId, user!.signWith);
        const result = await trackTransaction(
          {
            type: TransactionType.DEPOSIT,
            title: `Deposit ${amount} ${token}`,
            shortTitle: `Deposit ${amount}`,
            amount,
            symbol: token,
            chainId: fuse.id,
            fromAddress: safeAddress,
            toAddress: spender,
            metadata: {
              description:
                token === 'FUSE'
                  ? 'Deposit native FUSE from Solid wallet'
                  : 'Approve WFUSE for deposit from Solid wallet',
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              token === 'FUSE' ? 'Deposit failed' : 'Approve failed',
              fuse,
              onUserOpHash,
            ),
        );

        if (result === USER_CANCELLED_TRANSACTION) {
          throw new Error('User cancelled transaction');
        }

        if (result && typeof result === 'object' && 'transactionHash' in result) {
          txHash = (result as { transactionHash: `0x${string}` }).transactionHash;
        }
      }

      if (isSponsor) {
        trackingId = await createEvent(amount, spender, token);
        withRefreshToken(() =>
          createDeposit({
            eoaAddress: safeAddress,
            amount,
            trackingId,
            vault: VaultType.FUSE,
          }),
        );
      }

      if (txHash) setHash(txHash);
      updateUser({ ...user!, isDeposited: true });

      Sentry.addBreadcrumb({
        message: 'Deposit from Solid wallet completed successfully',
        category: 'deposit',
        data: { amount, transactionHash: txHash, safeAddress, srcChainId, isSponsor },
      });

      track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        amount,
        transaction_hash: txHash,
        deposit_type: 'solid_wallet',
        deposit_method: 'fuse_solid',
        chain_id: srcChainId,
        chain_name: 'fuse',
        is_sponsor: isSponsor,
        is_first_deposit: !user?.isDeposited,
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      trackIdentity(user?.userId!, {
        last_deposit_amount: parseFloat(amount),
        last_deposit_date: new Date().toISOString(),
        last_deposit_method: 'fuse_solid',
        last_deposit_chain: 'fuse',
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      setDepositStatus({ status: Status.SUCCESS });
      return trackingId;
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || 'Unknown error';

      Sentry.captureException(error, {
        tags: { operation: 'deposit_from_solid_fuse', step: 'execution' },
        extra: {
          amount,
          safeAddress: user?.safeAddress,
          srcChainId,
          errorMessage,
          depositStatus,
        },
        user: { id: user?.suborgId, address: user?.safeAddress },
      });

      const errAttribution = useAttributionStore.getState().getAttributionForEvent();
      track(TRACKING_EVENTS.DEPOSIT_ERROR, {
        amount,
        safe_address: user?.safeAddress,
        src_chain_id: srcChainId,
        deposit_status: depositStatus,
        source: 'deposit_from_solid_fuse',
        error: errorMessage,
        ...errAttribution,
        attribution_channel: getAttributionChannel(errAttribution),
      });

      const msg = errorMessage?.toLowerCase();
      let errMsg = '';
      if (
        msg.includes('user rejected') ||
        msg.includes('user denied') ||
        msg.includes('rejected by user') ||
        msg.includes('user cancelled')
      ) {
        errMsg = 'User rejected transaction';
      } else if (errorMessage?.includes(ERRORS.WAIT_TRANSACTION_RECEIPT)) {
        errMsg = ERRORS.WAIT_TRANSACTION_RECEIPT;
      }

      setDepositStatus({ status: Status.ERROR });
      setError(errMsg);
      throw error;
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
