import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { erc20Abi, TransactionReceipt } from 'viem';
import { base } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';

import { type StockVault } from '@/constants/stockVaults';
import { WITHDRAW_SECONDS_TO_DEADLINE } from '@/constants/withdraw';
import { useActivityActions } from '@/hooks/useActivityActions';
import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';

import useUser from './useUser';

/**
 * Discount, in basis points, the request offers the solver: the stock queues'
 * minimum (each accepts 1-100). The same 0.01% the withdraw form quotes.
 */
export const STOCK_VAULT_WITHDRAW_DISCOUNT_BPS = 1;

/**
 * The two calls a stock vault withdrawal sends from the Safe: approve the vault's
 * queue for the shares (the vault is the share token), then request the stock token
 * back on that queue.
 */
export const buildStockVaultWithdrawCalls = (stock: StockVault, shares: bigint) => [
  {
    to: stock.vault,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [stock.boringQueue, shares],
    }),
    value: 0n,
  },
  {
    to: stock.boringQueue,
    data: encodeFunctionData({
      abi: BoringQueue_ABI,
      functionName: 'requestOnChainWithdraw',
      args: [
        stock.stockToken.address,
        shares,
        STOCK_VAULT_WITHDRAW_DISCOUNT_BPS,
        WITHDRAW_SECONDS_TO_DEADLINE,
      ],
    }),
    value: 0n,
  },
];

type WithdrawStockVaultResult = {
  withdrawStockVault: (stock: StockVault, amount: string) => Promise<TransactionReceipt>;
  withdrawStockVaultStatus: Status;
  error: string | null;
};

/**
 * soAAPL → AAPLc (and every other stock vault) on Base, in one step, like soEURC:
 * the Safe approves the vault's on-chain queue for the shares and requests the
 * withdrawal there. The Safe-run solver fills it after the queue's maturity, and
 * the stock token lands in the Safe on Base. The request must stay open at least
 * the queue's three-day minimum, which the 7-day deadline covers.
 */
const useWithdrawStockVault = (): WithdrawStockVaultResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const [withdrawStockVaultStatus, setWithdrawStockVaultStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const withdrawStockVault = useCallback(
    async (stock: StockVault, amount: string) => {
      try {
        // Inside the try, so an amount that does not parse ends in the same error
        // state and Sentry report as any other failure.
        const shares = parseUnits(amount, stock.shareDecimals);
        if (!user) {
          throw new Error('User not found');
        }

        setWithdrawStockVaultStatus(Status.PENDING);
        setError(null);

        const transactions = buildStockVaultWithdrawCalls(stock, shares);
        const smartAccountClient = await safeAA(base, user.suborgId, user.signWith);

        const result = await trackTransaction(
          {
            type: TransactionType.WITHDRAW,
            title: `Withdraw ${amount} ${stock.shareSymbol}`,
            shortTitle: `Withdraw ${amount}`,
            amount,
            symbol: stock.shareSymbol,
            chainId: base.id,
            fromAddress: user.safeAddress,
            toAddress: stock.boringQueue,
            metadata: {
              description: `Withdraw ${amount} ${stock.shareSymbol} to ${stock.stockToken.symbol} on Base`,
              tokenAddress: stock.vault,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              `Withdraw ${stock.shareSymbol} failed`,
              base,
              onUserOpHash,
            ),
        );

        const transaction =
          result && typeof result === 'object' && 'transaction' in result
            ? result.transaction
            : result;

        if (transaction === USER_CANCELLED_TRANSACTION) {
          throw new Error('User cancelled transaction');
        }

        setWithdrawStockVaultStatus(Status.SUCCESS);
        return transaction;
      } catch (err) {
        console.error(err);
        setWithdrawStockVaultStatus(Status.ERROR);
        setError(err instanceof Error ? err.message : 'Unknown error');
        Sentry.captureException(err, {
          tags: { type: 'withdraw_stock_vault_error' },
          extra: { amount, vault: stock.shareSymbol, userAddress: user?.safeAddress },
        });
        throw err;
      }
    },
    [user, safeAA, trackTransaction],
  );

  return { withdrawStockVault, withdrawStockVaultStatus, error };
};

export default useWithdrawStockVault;
