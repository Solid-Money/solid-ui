import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { TransactionReceipt } from 'viem';
import { fuse } from 'viem/chains';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { track } from '@/lib/analytics';
import {
  EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID,
  EXPO_PUBLIC_CARD_FUNDING_CHAIN_KEY,
} from '@/lib/config';
import { USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';
import { getCardDepositTokenAddress, getCardFundingAddress } from '@/lib/utils';
import { executeBorrowAndBridge } from '@/lib/utils/borrowAndBridge';

import { useCardContracts } from './useCardContracts';
import { useCardDetails } from './useCardDetails';
import { useCardProvider } from './useCardProvider';
import useUser from './useUser';

type BridgeResult = {
  borrowAndDeposit: (amount: string) => Promise<TransactionReceipt>;
  bridgeStatus: Status;
  error: string | null;
};

const useBorrowAndDepositToCard = (): BridgeResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const { data: cardDetails } = useCardDetails();
  const { provider } = useCardProvider();
  const { data: contracts } = useCardContracts();
  const [bridgeStatus, setBridgeStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const borrowAndDeposit = useCallback(
    async (amountToBorrow: string) => {
      try {
        if (!user) {
          const err = new Error('User is not selected');
          track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_ERROR, {
            amount: amountToBorrow,
            error: 'User not found',
            step: 'validation',
            source: 'useBridgeToCard',
          });
          Sentry.captureException(err, {
            tags: { operation: 'bridge_to_card', step: 'validation' },
            extra: { amount: amountToBorrow, hasUser: !!user },
          });
          throw err;
        }
        if (!cardDetails) {
          throw new Error('Card details not found');
        }

        const arbitrumFundingAddress = getCardFundingAddress(
          cardDetails,
          provider,
          contracts ?? undefined,
        );
        if (!arbitrumFundingAddress) {
          const err = new Error('Arbitrum funding address not found for card');
          track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_ERROR, {
            amount: amountToBorrow,
            error: 'Arbitrum funding address not found',
            step: 'validation',
            source: 'useBridgeToCard',
          });
          Sentry.captureException(err, {
            tags: { operation: 'bridge_to_card', step: 'validation' },
            extra: { amount: amountToBorrow, hasCardDetails: !!cardDetails },
          });
          throw err;
        }

        track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_INITIATED, {
          amount: amountToBorrow,
          from_chain: fuse.id,
          to_chain: EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID,
          source: 'useBridgeToCard',
        });

        setBridgeStatus(Status.PENDING);
        setError(null);

        const transactionResult = await executeBorrowAndBridge({
          user: {
            safeAddress: user.safeAddress,
            suborgId: user.suborgId,
            signWith: user.signWith,
            userId: user.userId,
          },
          destinationAddress: arbitrumFundingAddress as Address,
          destinationChainId: EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID,
          destinationChainKey: EXPO_PUBLIC_CARD_FUNDING_CHAIN_KEY,
          destinationToken: getCardDepositTokenAddress(
            EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID,
          ) as Address,
          amountToBorrow,
          safeAA,
          trackTransaction,
          activityType: TransactionType.BORROW_AND_DEPOSIT_TO_CARD,
          activityTitle: 'Borrow and deposit to Card',
          flowTag: 'bridge_to_card',
        });

        if (transactionResult === USER_CANCELLED_TRANSACTION) {
          const err = new Error('User cancelled transaction');
          track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_CANCELLED, {
            amount: amountToBorrow,
            from_chain: fuse.id,
            to_chain: EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID,
            source: 'useBridgeToCard',
          });
          Sentry.captureException(err, {
            tags: {
              operation: 'bridge_to_card',
              step: 'execution',
              reason: 'user_cancelled',
            },
            extra: {
              amount: amountToBorrow,
              userAddress: user.safeAddress,
              destinationAddress: arbitrumFundingAddress,
              chainId: fuse.id,
            },
            user: { id: user.userId, address: user.safeAddress },
          });
          throw err;
        }

        track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_COMPLETED, {
          amount: amountToBorrow,
          transaction_hash: transactionResult.transactionHash,
          from_chain: fuse.id,
          to_chain: EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID,
          source: 'useBridgeToCard',
        });

        Sentry.addBreadcrumb({
          message: 'Bridge to Card transaction successful',
          category: 'bridge',
          data: {
            amount: amountToBorrow,
            transactionHash: transactionResult.transactionHash,
            userAddress: user.safeAddress,
            destinationAddress: arbitrumFundingAddress,
            chainId: fuse.id,
          },
        });

        setBridgeStatus(Status.SUCCESS);
        return transactionResult;
      } catch (err) {
        console.error(err);
        track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_ERROR, {
          amount: amountToBorrow,
          from_chain: fuse.id,
          to_chain: EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID,
          error: err instanceof Error ? err.message : 'Unknown error',
          user_cancelled: String(err).includes('cancelled'),
          step: 'execution',
          source: 'useBridgeToCard',
        });
        Sentry.captureException(err, {
          tags: { operation: 'bridge_to_card', step: 'execution' },
          extra: {
            amount: amountToBorrow,
            userAddress: user?.safeAddress,
            chainId: fuse.id,
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
            bridgeStatus,
          },
          user: { id: user?.suborgId, address: user?.safeAddress },
        });
        setBridgeStatus(Status.ERROR);
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      }
    },
    [user, cardDetails, provider, contracts, safeAA, trackTransaction, bridgeStatus],
  );

  return { borrowAndDeposit, bridgeStatus, error };
};

export default useBorrowAndDepositToCard;
