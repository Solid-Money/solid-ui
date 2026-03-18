import { useCallback, useState } from 'react';
import Toast from 'react-native-toast-message';
import { Address, encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { useActivityActions } from '@/hooks/useActivityActions';
import { useCardContracts } from '@/hooks/useCardContracts';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import {
  getCardDepositTokenAddress,
  getCardDepositTokenSymbol,
  getCardFundingAddress,
} from '@/lib/utils';
import { getChain } from '@/lib/wagmi';
import { useCardDepositStore } from '@/store/useCardDepositStore';

type CardDepositResult = {
  deposit: (amount: string) => Promise<void>;
  depositStatus: Status;
  error: string | null;
};

/**
 * Same-chain deposit from safeAA (smart account) to card: transfer deposit token
 * (e.g. rUSD on Base Sepolia) from the user's safe AA on the funding chain to
 * the card funding address. Use when Bridge/Swap are unavailable (e.g. testnet).
 */
const useCardDeposit = (): CardDepositResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const { setTransaction, setModal } = useCardDepositStore(
    useShallow(state => ({
      setTransaction: state.setTransaction,
      setModal: state.setModal,
    })),
  );
  const { data: cardDetails } = useCardDetails();
  const { provider } = useCardProvider();
  const { data: contracts } = useCardContracts();

  const [depositStatus, setDepositStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const fundingChainId = EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID;
  const fundingChain = getChain(fundingChainId);
  const depositTokenAddress = getCardDepositTokenAddress(fundingChainId) as Address;
  const depositTokenSymbol = getCardDepositTokenSymbol(provider);

  const deposit = useCallback(
    async (amount: string) => {
      setError(null);
      if (!user) {
        setError('User not selected');
        Toast.show({
          type: 'error',
          text1: 'User not selected',
          text2: 'Please sign in to deposit',
        });
        return;
      }
      if (!cardDetails) {
        setError('Card details not found');
        Toast.show({ type: 'error', text1: 'Card details not found' });
        return;
      }
      const fundingAddress = getCardFundingAddress(cardDetails, provider, contracts ?? undefined);
      if (!fundingAddress) {
        setError('Funding address not available');
        Toast.show({
          type: 'error',
          text1: 'Deposits not available',
          text2: 'This card does not support deposits',
        });
        return;
      }
      if (!fundingChain) {
        setError('Funding chain not supported');
        Toast.show({
          type: 'error',
          text1: 'Unsupported chain',
          text2: `Chain ${fundingChainId} is not configured`,
        });
        return;
      }
      if (!depositTokenAddress) {
        setError('Deposit token not configured');
        Toast.show({
          type: 'error',
          text1: 'Configuration error',
          text2: `${depositTokenSymbol} address not found`,
        });
        return;
      }

      setDepositStatus(Status.PENDING);
      const amountWei = parseUnits(amount, 6);

      try {
        const smartAccountClient = await safeAA(fundingChain, user.suborgId, user.signWith);

        const transactions = [
          {
            to: depositTokenAddress,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [fundingAddress as Address, amountWei],
            }),
            value: 0n,
          },
        ];

        const result = await trackTransaction(
          {
            type: TransactionType.CARD_TRANSACTION,
            title: 'Card Deposit',
            shortTitle: 'Card Deposit',
            amount,
            symbol: depositTokenSymbol,
            chainId: fundingChainId,
            fromAddress: user.safeAddress,
            toAddress: fundingAddress,
            status: TransactionStatus.PENDING,
            metadata: {
              description: `Deposit ${amount} ${depositTokenSymbol} to card`,
              processingStatus: 'sending',
              tokenAddress: depositTokenAddress,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Deposit to card failed',
              fundingChain,
              onUserOpHash,
            ),
        );

        if (result === USER_CANCELLED_TRANSACTION) {
          setDepositStatus(Status.ERROR);
          setError('Transaction cancelled');
          return;
        }

        setDepositStatus(Status.SUCCESS);
        setTransaction({ amount: Number(amount) });
        setModal(CARD_DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
      } catch (err) {
        setDepositStatus(Status.ERROR);
        setError(err instanceof Error ? err.message : 'Deposit failed');
        Toast.show({
          type: 'error',
          text1: 'Deposit failed',
          text2: err instanceof Error ? err.message : 'Please try again',
        });
        throw err;
      }
    },
    [
      user,
      cardDetails,
      provider,
      contracts,
      safeAA,
      fundingChain,
      fundingChainId,
      depositTokenAddress,
      depositTokenSymbol,
      trackTransaction,
      setTransaction,
      setModal,
    ],
  );

  return { deposit, depositStatus, error };
};

export default useCardDeposit;
