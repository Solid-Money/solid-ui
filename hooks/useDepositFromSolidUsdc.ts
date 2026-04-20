import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { type Address, encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { base, mainnet } from 'viem/chains';
import { useBlockNumber, useReadContract } from 'wagmi';

import { ERRORS } from '@/constants/errors';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { track, trackIdentity } from '@/lib/analytics';
import { bridgeDeposit, createDeposit } from '@/lib/api';
import { getAttributionChannel } from '@/lib/attribution';
import { EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import {
  DepositCategory,
  Status,
  StatusInfo,
  TransactionStatus,
  TransactionType,
  VaultType,
} from '@/lib/types';
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

const useDepositFromSolidUsdc = (
  tokenAddress: Address,
  token: string,
  minimumAmount: string = '10',
  category: DepositCategory = DepositCategory.SAVINGS,
): DepositResult => {
  const { user, safeAA } = useUser();
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const srcChainId = useDepositStore(state => state.srcChainId);
  const { createActivity, updateActivity } = useActivityActions();
  const updateUser = useUserStore(state => state.updateUser);

  const safeAddress = user?.safeAddress as Address | undefined;
  const isCard = category === DepositCategory.CARD;
  const targetChainId = isCard ? base.id : mainnet.id;
  const isTargetChain = srcChainId === targetChainId;
  const isEthereum = srcChainId === mainnet.id;

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: srcChainId,
    query: {
      enabled: !!srcChainId,
    },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [safeAddress as Address],
    chainId: srcChainId,
    query: {
      enabled: !!safeAddress && !!srcChainId && !!tokenAddress,
    },
  });

  const createEvent = async (amount: string, spender: Address, tokenSymbol: string) => {
    const clientTxId = await createActivity({
      title: isCard ? `Deposit ${tokenSymbol} to Card` : `Deposit ${tokenSymbol}`,
      amount,
      symbol: tokenSymbol,
      chainId: srcChainId,
      fromAddress: safeAddress,
      toAddress: spender,
      type: isCard ? TransactionType.CARD_DEPOSIT : TransactionType.DEPOSIT,
    });
    return clientTxId;
  };

  const deposit = async (amount: string) => {
    if (!token) return undefined;
    if (!srcChainId) {
      throw new Error(
        'Source chain is not selected. Please reopen the deposit flow and pick a chain.',
      );
    }

    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);
    let trackingId: string | undefined;

    try {
      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        amount,
        deposit_type: 'solid_wallet',
        deposit_method: isTargetChain
          ? isCard
            ? 'usdc_solid_base_card'
            : 'usdc_solid_ethereum'
          : isCard
            ? 'usdc_solid_bridge_card'
            : 'usdc_solid_bridge',
        deposit_destination: isCard ? 'card' : 'savings',
        chain_id: srcChainId,
        is_sponsor: Number(amount) >= Number(minimumAmount),
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      if (!safeAddress) {
        const err = new Error('Solid wallet (Safe) address not found');
        Sentry.captureException(err, {
          tags: {
            operation: 'deposit_from_solid_usdc',
            step: 'validation',
            reason: 'no_safe_address',
          },
          extra: { amount, srcChainId, hasUser: !!user },
        });
        throw err;
      }

      const isSponsor = Number(amount) >= Number(minimumAmount);

      if (!isSponsor) {
        throw new Error(`Minimum deposit amount is $${minimumAmount}`);
      }

      const spender = EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS as Address;

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      Sentry.addBreadcrumb({
        message: 'Starting deposit from Solid wallet (USDC)',
        category: 'deposit',
        data: { amount, safeAddress, srcChainId, token, isSponsor },
      });

      const amountWei = parseUnits(amount, 6);

      // Approve the bridge/deposit address to pull tokens from Safe on the src chain.
      const chain =
        srcChainId === mainnet.id
          ? mainnet
          : srcChainId === base.id
            ? base
            : ({ id: srcChainId } as any);
      const smartAccountClient = await safeAA(chain, user!.suborgId, user!.signWith);

      const approveTransaction = {
        to: tokenAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender, amountWei],
        }),
        value: 0n,
      };

      // Create activity for tracking
      trackingId = await createEvent(amount, spender, token);

      const result = await executeTransactions(
        smartAccountClient,
        [approveTransaction],
        'Approve failed',
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

      // Call backend to pull tokens from the Solid Safe AA and deliver to the
      // target (savings vault on Ethereum, or Rain card funding address on Base).
      const depositPromise = isTargetChain
        ? withRefreshToken(() =>
            createDeposit({
              eoaAddress: safeAddress,
              amount,
              trackingId,
              vault: isCard ? undefined : VaultType.USDC,
              category: isCard ? DepositCategory.CARD : DepositCategory.SAVINGS,
            }),
          )
        : withRefreshToken(() =>
            bridgeDeposit({
              srcToken: token,
              eoaAddress: safeAddress,
              srcChainId,
              amount,
              trackingId,
              category: isCard ? DepositCategory.CARD : DepositCategory.SAVINGS,
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
            message: 'Deposit from Solid wallet (USDC) completed successfully',
            category: 'deposit',
            data: { amount, safeAddress, srcChainId, isSponsor },
          });

          const depositMethod = isTargetChain
            ? isCard
              ? 'usdc_solid_base_card'
              : 'usdc_solid_ethereum'
            : isCard
              ? 'usdc_solid_bridge_card'
              : 'usdc_solid_bridge';

          track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
            user_id: user?.userId,
            safe_address: user?.safeAddress,
            amount,
            deposit_type: 'solid_wallet',
            deposit_method: depositMethod,
            deposit_destination: isCard ? 'card' : 'savings',
            chain_id: srcChainId,
            is_sponsor: isSponsor,
            is_first_deposit: !user?.isDeposited,
            ...attributionData,
            attribution_channel: attributionChannel,
          });

          trackIdentity(user?.userId!, {
            last_deposit_amount: parseFloat(amount),
            last_deposit_date: new Date().toISOString(),
            last_deposit_method: depositMethod,
            last_deposit_chain: isEthereum
              ? 'ethereum'
              : srcChainId === base.id
                ? 'base'
                : String(srcChainId),
            ...attributionData,
            attribution_channel: attributionChannel,
          });
        })
        .catch(err => {
          console.error('Sponsored Solid USDC deposit failed:', err);
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
        tags: { operation: 'deposit_from_solid_usdc', step: 'execution' },
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
        source: 'deposit_from_solid_usdc',
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

export default useDepositFromSolidUsdc;
