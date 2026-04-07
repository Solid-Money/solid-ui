import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { type Address, encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';
import { useBalance, useBlockNumber, useReadContract } from 'wagmi';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import { ERRORS } from '@/constants/errors';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { track, trackIdentity } from '@/lib/analytics';
import { getAttributionChannel } from '@/lib/attribution';
import { getChain } from '@/lib/thirdweb';
import { Status, StatusInfo, TransactionStatus, TransactionType } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';
import { useAttributionStore } from '@/store/useAttributionStore';
import { useDepositStore } from '@/store/useDepositStore';

import useUser from './useUser';

type TransferResult = {
  balance: bigint | undefined;
  transfer: (amount: string) => Promise<string | undefined>;
  transferStatus: StatusInfo;
  error: string | null;
  hash: Address | undefined;
};

/**
 * Hook for transferring tokens from a connected external wallet (EOA)
 * to the user's Safe wallet address. Used in the "Add Funds" flow (Step 1).
 * Supports both ERC-20 and native token (ETH, FUSE) transfers.
 */
const useTransferToWallet = (tokenAddress: Address, token: string, isNative: boolean): TransferResult => {
  const { user } = useUser();
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const [transferStatus, setTransferStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const eoaAddress = account?.address as Address;
  const srcChainId = useDepositStore(state => state.srcChainId);
  const { createActivity, updateActivity } = useActivityActions();

  const safeAddress = user?.safeAddress as Address | undefined;

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: srcChainId,
    query: {
      enabled: !!srcChainId,
    },
  });

  // Native token balance (ETH, FUSE)
  const { data: nativeBalanceData, refetch: refetchNativeBalance } = useBalance({
    address: eoaAddress,
    chainId: srcChainId,
    query: {
      enabled: !!eoaAddress && !!srcChainId && isNative,
    },
  });

  // ERC-20 token balance
  const { data: erc20Balance, refetch: refetchErc20Balance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [eoaAddress as Address],
    chainId: srcChainId,
    query: {
      enabled: !!eoaAddress && !!srcChainId && !isNative,
    },
  });

  const balance = isNative ? nativeBalanceData?.value : erc20Balance;
  const refetchBalance = isNative ? refetchNativeBalance : refetchErc20Balance;

  const transfer = async (amount: string) => {
    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);
    let trackingId: string | undefined;

    try {
      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        eoa_address: eoaAddress,
        amount,
        deposit_type: 'wallet_transfer',
        deposit_method: 'eoa_to_safe',
        chain_id: srcChainId,
        chain_name: BRIDGE_TOKENS[srcChainId]?.name,
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      if (!eoaAddress) {
        throw new Error('External wallet not connected');
      }

      if (!safeAddress) {
        throw new Error('Solid wallet address not found');
      }

      setTransferStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      Sentry.addBreadcrumb({
        message: 'Starting transfer to wallet',
        category: 'transfer',
        data: { amount, eoaAddress, safeAddress, srcChainId, token },
      });

      // Determine decimals based on token
      const isStablecoin = token === 'USDC' || token === 'USDT';
      const decimals = isStablecoin ? 6 : 18;
      const amountWei = parseUnits(amount, decimals);

      // Switch to the correct chain
      const chain = getChain(srcChainId);
      if (chain) {
        await wallet?.switchChain(chain);
      }

      // Create activity for tracking
      trackingId = await createActivity({
        title: `Add ${token} to wallet`,
        amount,
        symbol: token,
        chainId: srcChainId,
        fromAddress: eoaAddress,
        toAddress: safeAddress,
        type: TransactionType.FUND,
      });

      setTransferStatus({ status: Status.PENDING, message: 'Confirming transfer' });

      let transaction;
      if (isNative) {
        // Native token transfer (ETH, FUSE) — simple value send
        transaction = await account?.sendTransaction({
          chainId: srcChainId,
          to: safeAddress,
          value: amountWei,
        });
      } else {
        // ERC-20 transfer from EOA to Safe
        const transferData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [safeAddress, amountWei],
        });

        transaction = await account?.sendTransaction({
          chainId: srcChainId,
          to: tokenAddress,
          data: transferData,
        });
      }

      if (!transaction?.transactionHash) {
        throw new Error('Transaction failed - no hash returned');
      }

      setHash(transaction.transactionHash as Address);
      updateActivity(trackingId, {
        status: TransactionStatus.PROCESSING,
        hash: transaction.transactionHash,
      });

      // Return immediately so the UI can show the transaction status screen.
      // Wait for the receipt in the background and update the activity when confirmed.
      setTransferStatus({ status: Status.SUCCESS });

      const txHash = transaction.transactionHash;
      const capturedTrackingId = trackingId;

      waitForTransactionReceipt(publicClient(srcChainId), {
        hash: txHash as `0x${string}`,
      })
        .then(() => {
          updateActivity(capturedTrackingId!, { status: TransactionStatus.SUCCESS });

          track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
            user_id: user?.userId,
            safe_address: user?.safeAddress,
            eoa_address: eoaAddress,
            amount,
            transaction_hash: txHash,
            deposit_type: 'wallet_transfer',
            deposit_method: 'eoa_to_safe',
            chain_id: srcChainId,
            ...attributionData,
            attribution_channel: attributionChannel,
          });

          trackIdentity(user?.userId!, {
            last_deposit_amount: parseFloat(amount),
            last_deposit_date: new Date().toISOString(),
            last_deposit_method: 'eoa_to_safe',
            last_deposit_chain: BRIDGE_TOKENS[srcChainId]?.name || String(srcChainId),
            ...attributionData,
            attribution_channel: attributionChannel,
          });
        })
        .catch(err => {
          console.error('Receipt confirmation failed:', err);
          updateActivity(capturedTrackingId!, {
            status: TransactionStatus.FAILED,
            metadata: { error: err?.message, failedAt: new Date().toISOString() },
          });
        });

      return trackingId;
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || 'Unknown error';

      Sentry.captureException(error, {
        tags: { operation: 'transfer_to_wallet', step: 'execution' },
        extra: {
          amount,
          eoaAddress,
          safeAddress: user?.safeAddress,
          srcChainId,
          errorMessage,
        },
        user: { id: user?.suborgId, address: user?.safeAddress },
      });

      track(TRACKING_EVENTS.DEPOSIT_ERROR, {
        amount,
        eoa_address: eoaAddress,
        safe_address: user?.safeAddress,
        src_chain_id: srcChainId,
        source: 'transfer_to_wallet',
        error: errorMessage,
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

      setTransferStatus({ status: Status.ERROR });
      setError(errMsg);
      throw error;
    }
  };

  useEffect(() => {
    refetchBalance();
  }, [blockNumber, refetchBalance]);

  return {
    balance,
    transfer,
    transferStatus,
    error,
    hash,
  };
};

export default useTransferToWallet;
