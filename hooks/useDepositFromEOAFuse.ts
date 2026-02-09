import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { type Address, erc20Abi, parseUnits } from 'viem';
import { fuse } from 'viem/chains';
import { useBalance, useBlockNumber, useChainId, useReadContract } from 'wagmi';

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
import { getChain } from '@/lib/thirdweb';
import { Status, StatusInfo, TransactionType, VaultType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import {
  checkAndSetAllowanceToken,
  getTransactionReceipt,
  sendTransaction,
} from '@/lib/utils/contract';
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

const useDepositFromEOAFuse = (tokenAddress: Address, token: string): DepositResult => {
  const { user } = useUser();
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const chainId = useChainId();
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const eoaAddress = account?.address as Address;
  const updateUser = useUserStore(state => state.updateUser);
  const srcChainId = useDepositStore(state => state.srcChainId);
  const { createActivity } = useActivity();

  const isFuseChain = srcChainId === fuse.id;
  const isNativeFuse = token === 'FUSE';

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
    args: [eoaAddress as Address],
    chainId: fuse.id,
    query: {
      enabled: !!eoaAddress && isFuseChain && !isNativeFuse,
    },
  });

  const { data: nativeBalanceData, refetch: refetchNativeBalance } = useBalance({
    address: eoaAddress as `0x${string}` | undefined,
    chainId: fuse.id,
    query: {
      enabled: !!eoaAddress && isFuseChain && isNativeFuse,
    },
  });

  const balance = isNativeFuse ? nativeBalanceData?.value : erc20Balance;

  const switchChain = async (chainId: number) => {
    try {
      const chain = getChain(chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }
      await wallet?.switchChain(chain);
    } catch (error) {
      throw new Error(`${ERRORS.ERROR_SWITCHING_CHAIN}: ${error}`);
    }
  };

  const createEvent = async (amount: string, spender: Address, token: string) => {
    const clientTxId = await createActivity({
      title: `Deposited ${token}`,
      amount,
      symbol: 'soFUSE',
      chainId: srcChainId,
      fromAddress: eoaAddress,
      toAddress: spender,
      type: TransactionType.DEPOSIT,
    });

    return clientTxId;
  };

  const deposit = async (amount: string) => {
    if (!isFuseChain) return undefined;
    // Capture attribution context for conversion tracking
    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);

    let trackingId: string | undefined;
    try {
      // Track deposit initiation with attribution for conversion funnel analysis
      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        eoa_address: eoaAddress,
        amount,
        deposit_type: 'connected_wallet',
        deposit_method: 'fuse_direct',
        chain_id: srcChainId,
        chain_name: 'fuse',
        is_sponsor: Number(amount) >= Number(EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT),
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      if (!eoaAddress) {
        const error = new Error('EOA not connected');
        Sentry.captureException(error, {
          tags: {
            operation: 'deposit_from_eoa',
            step: 'validation',
            reason: 'no_eoa_address',
          },
          extra: { amount, srcChainId },
        });
        throw error;
      }

      if (!user?.safeAddress) {
        const error = new Error('User safe address not found');
        Sentry.captureException(error, {
          tags: {
            operation: 'deposit_from_eoa',
            step: 'validation',
            reason: 'no_safe_address',
          },
          extra: { amount, eoaAddress, srcChainId, hasUser: !!user },
        });
        throw error;
      }

      const isSponsor = Number(amount) >= Number(EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT);
      const spender = EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS as Address;

      // Track deposit validation passed
      track(TRACKING_EVENTS.DEPOSIT_VALIDATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        eoa_address: eoaAddress,
        amount,
        is_sponsor: isSponsor,
        chain_id: srcChainId,
        deposit_type: 'connected_wallet',
      });

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      Sentry.addBreadcrumb({
        message: 'Starting deposit from EOA',
        category: 'deposit',
        data: {
          amount,
          eoaAddress,
          srcChainId,
          token,
          isSponsor,
        },
      });

      const amountWei = parseUnits(amount, 18);

      let txHash: `0x${string}` | undefined;
      let transaction: { transactionHash: `0x${string}` } | undefined = {
        transactionHash: '' as `0x${string}`,
      };
      if (token === 'WFUSE') {
        // Track ethereum deposit start
        track(TRACKING_EVENTS.DEPOSIT_TRANSACTION_STARTED, {
          user_id: user?.userId,
          safe_address: user?.safeAddress,
          eoa_address: eoaAddress,
          amount,
          is_sponsor: isSponsor,
          chain_id: srcChainId,
          deposit_type: 'connected_wallet',
          deposit_method: 'ethereum_direct',
        });

        await switchChain(srcChainId);

        const hash = await checkAndSetAllowanceToken(
          tokenAddress,
          eoaAddress,
          spender,
          amountWei,
          srcChainId,
        );
        if (hash) {
          const receipt = await getTransactionReceipt(srcChainId, hash as `0x${string}`);
          if (!receipt) {
            throw new Error('Failed to get transaction receipt');
          }
          if (receipt.status !== 'success') {
            throw new Error('Transaction failed');
          }
        }

        if (isSponsor) {
          Sentry.addBreadcrumb({
            message: 'Creating sponsored deposit on Ethereum',
            category: 'deposit',
            data: { amount, eoaAddress, isEthereum: true, isSponsor: true },
          });

          trackingId = await createEvent(amount, spender, token);

          withRefreshToken(() =>
            createDeposit({
              eoaAddress,
              amount,
              trackingId,
              vault: VaultType.FUSE,
            }),
          );
        }

        txHash = transaction?.transactionHash;
        setHash(txHash);
        updateUser({
          ...user,
          isDeposited: true,
        });

        Sentry.addBreadcrumb({
          message: 'Deposit from EOA completed successfully',
          category: 'deposit',
          data: {
            amount,
            transactionHash: txHash,
            eoaAddress,
            userId: user.userId,
            safeAddress: user.safeAddress,
            srcChainId,
            isSponsor,
          },
        });

        // Track deposit success with attribution for ROI measurement
        track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
          user_id: user?.userId,
          safe_address: user?.safeAddress,
          eoa_address: eoaAddress,
          amount,
          transaction_hash: txHash,
          deposit_type: 'connected_wallet',
          deposit_method: 'fuse_direct',
          chain_id: srcChainId,
          chain_name: 'fuse',
          is_sponsor: isSponsor,
          is_first_deposit: !user?.isDeposited,
          ...attributionData,
          attribution_channel: attributionChannel,
        });

        trackIdentity(user?.userId, {
          last_deposit_amount: parseFloat(amount),
          last_deposit_date: new Date().toISOString(),
          last_deposit_method: 'fuse_direct',
          last_deposit_chain: 'fuse',
          ...attributionData,
          attribution_channel: attributionChannel,
        });

        setDepositStatus({ status: Status.SUCCESS });
        return trackingId;
      }

      if (token === 'FUSE') {
        track(TRACKING_EVENTS.DEPOSIT_TRANSACTION_STARTED, {
          user_id: user?.userId,
          safe_address: user?.safeAddress,
          eoa_address: eoaAddress,
          amount,
          is_sponsor: isSponsor,
          chain_id: srcChainId,
          deposit_type: 'connected_wallet',
          deposit_method: 'fuse_direct',
        });

        await switchChain(srcChainId);

        const depositValueWei = parseUnits(
          (Number(amount) - Number(EXPO_PUBLIC_FUSE_GAS_RESERVE)).toString(),
          18,
        );
        txHash = await sendTransaction(fuse.id, {
          to: spender,
          value: depositValueWei,
        });

        if (isSponsor) {
          trackingId = await createEvent(amount, spender, token);
          withRefreshToken(() =>
            createDeposit({
              eoaAddress,
              amount,
              trackingId,
              vault: VaultType.FUSE,
            }),
          );
        }

        setHash(txHash);
        updateUser({
          ...user,
          isDeposited: true,
        });

        Sentry.addBreadcrumb({
          message: 'Deposit from EOA (native FUSE) completed successfully',
          category: 'deposit',
          data: {
            amount,
            transactionHash: txHash,
            eoaAddress,
            userId: user.userId,
            safeAddress: user.safeAddress,
            srcChainId,
            isSponsor,
          },
        });

        track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
          user_id: user?.userId,
          safe_address: user?.safeAddress,
          eoa_address: eoaAddress,
          amount,
          transaction_hash: txHash,
          deposit_type: 'connected_wallet',
          deposit_method: 'fuse_direct',
          chain_id: srcChainId,
          chain_name: 'fuse',
          is_sponsor: isSponsor,
          is_first_deposit: !user?.isDeposited,
          ...attributionData,
          attribution_channel: attributionChannel,
        });

        trackIdentity(user?.userId, {
          last_deposit_amount: parseFloat(amount),
          last_deposit_date: new Date().toISOString(),
          last_deposit_method: 'fuse_direct',
          last_deposit_chain: 'fuse',
          ...attributionData,
          attribution_channel: attributionChannel,
        });

        setDepositStatus({ status: Status.SUCCESS });
        return trackingId;
      }
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || 'Unknown error';

      Sentry.captureException(error, {
        tags: {
          operation: 'deposit_from_eoa',
          step: 'execution',
        },
        extra: {
          amount,
          eoaAddress,
          safeAddress: user?.safeAddress,
          srcChainId,
          chainId,
          errorMessage,
          depositStatus,
        },
        user: {
          id: user?.suborgId,
          address: user?.safeAddress,
        },
      });

      track(TRACKING_EVENTS.DEPOSIT_ERROR, {
        amount: amount,
        eoa_address: eoaAddress,
        safe_address: user?.safeAddress,
        src_chain_id: srcChainId,
        chain_id: chainId,
        deposit_status: depositStatus,
        source: 'deposit_from_eoa',
        error: errorMessage,
        ...attributionData,
        attribution_channel: attributionChannel,
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
      } else if (errorMessage?.includes(ERRORS.ERROR_SWITCHING_CHAIN)) {
        errMsg = ERRORS.ERROR_SWITCHING_CHAIN;
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

export default useDepositFromEOAFuse;
