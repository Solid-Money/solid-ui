import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { TransactionReceipt } from 'viem';
import { base } from 'viem/chains';

import { useActivityActions } from '@/hooks/useActivityActions';
import { USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';
import { executeBorrowAndBridge } from '@/lib/utils/borrowAndBridge';
import { getStargateToken } from '@/lib/utils/stargate';

import useUser from './useUser';

type AgentDepositResult = {
  borrowAndDeposit: (amount: string) => Promise<TransactionReceipt>;
  bridgeStatus: Status;
  error: string | null;
};

const useBorrowAndDepositToAgent = (agentEoaAddress?: string): AgentDepositResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const [bridgeStatus, setBridgeStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const borrowAndDeposit = useCallback(
    async (amountToBorrow: string) => {
      try {
        if (!user) throw new Error('User is not selected');
        if (!agentEoaAddress) throw new Error('Agent wallet not provisioned');
        const baseUsdc = getStargateToken(base.id);
        if (!baseUsdc) throw new Error('Base USDC not configured for Stargate');

        setBridgeStatus(Status.PENDING);
        setError(null);

        const transactionResult = await executeBorrowAndBridge({
          user: {
            safeAddress: user.safeAddress,
            suborgId: user.suborgId,
            signWith: user.signWith,
            userId: user.userId,
          },
          destinationAddress: agentEoaAddress as Address,
          destinationChainId: base.id,
          destinationChainKey: 'base',
          destinationToken: baseUsdc as Address,
          amountToBorrow,
          safeAA,
          trackTransaction,
          activityType: TransactionType.AGENT_WALLET_DEPOSIT,
          activityTitle: 'Deposit to Agent Wallet',
          flowTag: 'borrow_and_deposit_to_agent',
        });

        if (transactionResult === USER_CANCELLED_TRANSACTION) {
          throw new Error('User cancelled transaction');
        }

        Sentry.addBreadcrumb({
          message: 'Borrow + deposit to Agent successful',
          category: 'bridge',
          data: {
            amount: amountToBorrow,
            transactionHash: transactionResult.transactionHash,
            userAddress: user.safeAddress,
            destinationAddress: agentEoaAddress,
            destinationChainId: base.id,
          },
        });

        setBridgeStatus(Status.SUCCESS);
        return transactionResult;
      } catch (err) {
        console.error(err);
        Sentry.captureException(err, {
          tags: { operation: 'borrow_and_deposit_to_agent' },
          extra: {
            amount: amountToBorrow,
            userAddress: user?.safeAddress,
            agentEoaAddress,
          },
          user: user ? { id: user.userId, address: user.safeAddress } : undefined,
        });
        setBridgeStatus(Status.ERROR);
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      }
    },
    [user, agentEoaAddress, safeAA, trackTransaction],
  );

  return { borrowAndDeposit, bridgeStatus, error };
};

export default useBorrowAndDepositToAgent;
