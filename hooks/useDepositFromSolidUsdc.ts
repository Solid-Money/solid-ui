import { useEffect, useState } from 'react';
import { type Address, erc20Abi, parseUnits } from 'viem';
import { base, mainnet } from 'viem/chains';
import { useBlockNumber, useReadContract } from 'wagmi';

import { useActivityActions } from '@/hooks/useActivityActions';
import { bridgeDeposit, createDeposit } from '@/lib/api';
import { EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS } from '@/lib/config';
import { buildDepositApproval } from '@/lib/deposit/allowance';
import {
  captureDepositError,
  depositBreadcrumb,
  DepositContext,
  trackDepositCompleted,
  trackDepositInitiated,
} from '@/lib/deposit/telemetry';
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

  const chainName =
    srcChainId === mainnet.id ? 'ethereum' : srcChainId === base.id ? 'base' : String(srcChainId);

  const depositMethod = isTargetChain
    ? isCard
      ? 'usdc_solid_base_card'
      : 'usdc_solid_ethereum'
    : isCard
      ? 'usdc_solid_bridge_card'
      : 'usdc_solid_bridge';

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

    const isSponsor = Number(amount) >= Number(minimumAmount);
    const ctx: DepositContext = {
      user,
      amount,
      chainId: srcChainId,
      chainName,
      depositType: 'solid_wallet',
      depositMethod,
      depositDestination: isCard ? 'card' : 'savings',
      isSponsor,
      operation: 'deposit_from_solid_usdc',
    };

    let trackingId: string | undefined;

    try {
      trackDepositInitiated(ctx);

      if (!safeAddress) {
        throw new Error('Solid wallet (Safe) address not found');
      }
      if (!isCard && !isSponsor) {
        throw new Error(`Minimum deposit amount is $${minimumAmount}`);
      }

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      depositBreadcrumb('Starting deposit from Solid wallet (USDC)', {
        amount,
        safeAddress,
        srcChainId,
        token,
        isSponsor,
      });

      const amountWei = parseUnits(amount, 6);
      const spender = EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS as Address;

      // Let the backend pull these funds out of the Safe on the source chain.
      const chain =
        srcChainId === mainnet.id
          ? mainnet
          : srcChainId === base.id
            ? base
            : ({ id: srcChainId } as any);
      const smartAccountClient = await safeAA(chain, user!.suborgId, user!.signWith);
      const approveTransaction = await buildDepositApproval({
        tokenAddress,
        owner: safeAddress,
        spender,
        amount: amountWei,
        chainId: srcChainId,
      });

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

          depositBreadcrumb('Deposit from Solid wallet (USDC) completed successfully', {
            amount,
            safeAddress,
            srcChainId,
            isSponsor,
          });

          trackDepositCompleted(ctx);
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
