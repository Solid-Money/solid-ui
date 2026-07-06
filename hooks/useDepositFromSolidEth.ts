import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { type Address, encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { useBalance, useBlockNumber, useReadContract } from 'wagmi';

import { ERRORS } from '@/constants/errors';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { track, trackIdentity } from '@/lib/analytics';
import { createDeposit } from '@/lib/api';
import { getAttributionChannel } from '@/lib/attribution';
import { ADDRESSES, EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, StatusInfo, TransactionStatus, TransactionType, VaultType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useAttributionStore } from '@/store/useAttributionStore';
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

    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);
    let trackingId: string | undefined;

    try {
      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        amount,
        deposit_type: 'solid_wallet',
        deposit_method: 'eth_solid',
        chain_id: srcChainId,
        is_sponsor: Number(amount) >= Number(minimumAmount),
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      if (!safeAddress) {
        const err = new Error('Solid wallet (Safe) address not found');
        Sentry.captureException(err, {
          tags: {
            operation: 'deposit_from_solid_eth',
            step: 'validation',
            reason: 'no_safe_address',
          },
          extra: { amount, srcChainId, hasUser: !!user },
        });
        throw err;
      }

      const isSponsor = Number(amount) >= Number(minimumAmount);

      if (!isSponsor) {
        throw new Error(`Minimum deposit amount is ${minimumAmount} ETH`);
      }

      const spender = EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS as Address;

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      Sentry.addBreadcrumb({
        message: 'Starting ETH deposit from Solid wallet',
        category: 'deposit',
        data: { amount, safeAddress, srcChainId, token, isSponsor, isNativeEth },
      });

      const amountWei = parseUnits(amount, 18);

      const chain = mainnet;
      const smartAccountClient = await safeAA(chain, user!.suborgId, user!.signWith);

      // Build transactions: for native ETH, wrap first then approve WETH;
      // for WETH, just approve.
      const transactions: { to: Address; data: `0x${string}`; value: bigint }[] = [];

      if (isNativeEth) {
        // Wrap ETH → WETH
        transactions.push({
          to: ADDRESSES.ethereum.weth,
          data: encodeFunctionData({ abi: WETH_ABI, functionName: 'deposit' }),
          value: amountWei,
        });
        // Approve WETH for spender
        transactions.push({
          to: ADDRESSES.ethereum.weth,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, amountWei],
          }),
          value: 0n,
        });
      } else {
        // WETH: just approve
        transactions.push({
          to: tokenAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, amountWei],
          }),
          value: 0n,
        });
      }

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

          Sentry.addBreadcrumb({
            message: 'Deposit from Solid wallet (ETH) completed successfully',
            category: 'deposit',
            data: { amount, safeAddress, srcChainId, isSponsor },
          });

          track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
            user_id: user?.userId,
            safe_address: user?.safeAddress,
            amount,
            deposit_type: 'solid_wallet',
            deposit_method: 'eth_solid',
            chain_id: srcChainId,
            is_sponsor: isSponsor,
            is_first_deposit: !user?.isDeposited,
            ...attributionData,
            attribution_channel: attributionChannel,
          });

          trackIdentity(user?.userId!, {
            last_deposit_amount: parseFloat(amount),
            last_deposit_date: new Date().toISOString(),
            last_deposit_method: 'eth_solid',
            last_deposit_chain: 'ethereum',
            ...attributionData,
            attribution_channel: attributionChannel,
          });
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
      const errorMessage = error?.message || 'Unknown error';

      Sentry.captureException(error, {
        tags: { operation: 'deposit_from_solid_eth', step: 'execution' },
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
        source: 'deposit_from_solid_eth',
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

      if (trackingId) {
        updateActivity(trackingId, {
          status: TransactionStatus.FAILED,
          metadata: { error: errorMessage, failedAt: new Date().toISOString() },
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
