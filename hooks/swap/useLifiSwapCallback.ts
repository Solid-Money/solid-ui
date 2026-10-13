import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Address, encodeFunctionData, erc20Abi, formatUnits } from 'viem';

import { CHAIN_NAMES } from '@/constants/chains';
import { useActivityActions } from '@/hooks/useActivityActions';
import useUser from '@/hooks/useUser';
import { recordLifiSwapFee } from '@/lib/api/lifi-swap';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { TransactionType } from '@/lib/types';
import { LifiSwapQuote } from '@/lib/types/lifi-swap';
import { withRefreshToken } from '@/lib/utils';
import { generateId } from '@/lib/utils/generate-id';
import { getChain, publicClient } from '@/lib/wagmi';
import { useLifiSwapStore } from '@/store/lifiSwapStore';
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';

/** Retries for booking the fee: the receipt can lag the bundler's on a fast chain. */
const FEE_RECORD_ATTEMPTS = 4;
const FEE_RECORD_BACKOFF_MS = 5_000;

export type LifiSwapResult =
  | { kind: 'cancelled' }
  | { kind: 'completed'; transactionHash: `0x${string}` }
  | { kind: 'bridging'; transactionHash: `0x${string}`; clientTxId: string };

/**
 * Signs and sends a LI.FI swap from the user's Safe on the source chain.
 *
 * One user operation: an exact approval when the route spends an ERC-20, then
 * LI.FI's call. Solid's fee is inside that call (LI.FI takes it as our
 * integrator fee), so unlike a Fuse swap there is no fee transfer of our own.
 * A first swap on a chain also deploys the Safe there, in the same operation.
 */
export function useLifiSwapCallback() {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const queryClient = useQueryClient();
  const [isSending, setIsSending] = useState(false);

  const swap = useCallback(
    async (quote: LifiSwapQuote): Promise<LifiSwapResult> => {
      if (!user?.safeAddress || !user.suborgId || !user.signWith)
        throw new Error('Your wallet is not ready. Reopen the swap and try again.');

      const chain = getChain(quote.fromChainId);
      if (!chain) throw new Error('This network is not supported for swaps yet.');

      const safe = user.safeAddress as Address;
      const fromAmount = BigInt(quote.fromAmount);
      const isNativeIn = BigInt(quote.fromToken.address) === 0n;
      const isCrossChain = quote.fromChainId !== quote.toChainId;
      const fromSymbol = quote.fromToken.symbol;
      const toSymbol = quote.toToken.symbol;

      const accountSession = useRewardsUpgradeStore.getState().session;
      const assertAccount = async () => {
        if (
          selectedRewardsUserId() !== user.userId ||
          useRewardsUpgradeStore.getState().session !== accountSession
        )
          throw new Error('Account changed. Reopen the swap for the selected account.');
      };
      await assertAccount();
      setIsSending(true);

      try {
        const calls: { to: Address; data: `0x${string}`; value: bigint }[] = [];

        if (!isNativeIn) {
          const token = quote.fromToken.address as Address;
          // A counterfactual Safe has no allowance; the read just returns 0.
          const allowance = await publicClient(quote.fromChainId).readContract({
            address: token,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [safe, quote.approvalAddress],
          });
          if (allowance < fromAmount) {
            // USDT on Ethereum refuses to move a non-zero allowance to another
            // non-zero value; resetting first is harmless for every other token.
            if (allowance > 0n) calls.push(approve(token, quote.approvalAddress, 0n));
            calls.push(approve(token, quote.approvalAddress, fromAmount));
          }
        }

        calls.push({
          to: quote.transactionRequest.to,
          data: quote.transactionRequest.data,
          value: BigInt(quote.transactionRequest.value || '0'),
        });

        const smartAccountClient = await safeAA(chain, user.suborgId, user.signWith);
        const clientTxId = generateId();
        const amount = formatUnits(fromAmount, quote.fromToken.decimals);
        const toAmount = formatUnits(BigInt(quote.toAmount), quote.toToken.decimals);
        const route = isCrossChain
          ? `${CHAIN_NAMES[quote.fromChainId] ?? quote.fromChainId} → ${CHAIN_NAMES[quote.toChainId] ?? quote.toChainId}`
          : (CHAIN_NAMES[quote.fromChainId] ?? '');

        const result = await trackTransaction(
          {
            type: TransactionType.SWAP,
            clientTxId,
            title: `Swap ${fromSymbol} for ${toSymbol}`,
            shortTitle: `${fromSymbol} → ${toSymbol}`,
            amount,
            symbol: fromSymbol,
            chainId: quote.fromChainId,
            fromAddress: safe,
            toAddress: quote.transactionRequest.to,
            metadata: {
              description: `Swap ${fromSymbol} for ${toSymbol} (${route})`,
              platform: 'lifi',
              slippage: String(quote.slippage * 100),
              inputToken: fromSymbol,
              outputToken: toSymbol,
              inputAmount: amount,
              outputAmount: toAmount,
              fromChainId: quote.fromChainId,
              toChainId: quote.toChainId,
              lifiQuoteId: quote.id,
              route: quote.steps.map(step => step.name).join(' → '),
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              calls,
              'Swap failed',
              chain,
              onUserOpHash,
              assertAccount,
            ),
        );

        if (result === USER_CANCELLED_TRANSACTION) return { kind: 'cancelled' };

        const { transaction, transactionHash } = result;
        if (!transactionHash || transaction?.status !== 'success')
          throw new Error('Swap has not been confirmed');

        if (quote.solidFee.percentage > 0) {
          void bookFee(quote.fromChainId, transactionHash);
        }

        queryClient.invalidateQueries({ queryKey: ['balance'] });
        queryClient.invalidateQueries({ queryKey: ['tokenBalances'] });
        queryClient.invalidateQueries({ queryKey: ['swap-fuse-balances'] });

        if (!isCrossChain) return { kind: 'completed', transactionHash };

        useLifiSwapStore.getState().actions.track({
          clientTxId,
          userId: user.userId,
          txHash: transactionHash,
          fromChainId: quote.fromChainId,
          toChainId: quote.toChainId,
          fromSymbol,
          toSymbol,
          fromAmount: amount,
          toAmount,
          etaSeconds: quote.executionDurationSeconds,
          submittedAt: Date.now(),
          status: 'PENDING',
        });
        return { kind: 'bridging', transactionHash, clientTxId };
      } catch (error: any) {
        if (error === USER_CANCELLED_TRANSACTION) return { kind: 'cancelled' };
        const message = error?.message?.toLowerCase() || '';
        if (
          message.includes('user cancelled') ||
          message.includes('user denied') ||
          message.includes('user rejected')
        )
          return { kind: 'cancelled' };

        Sentry.captureException(error, {
          tags: { type: 'lifi_swap_execution_failed', fromChainId: quote.fromChainId },
          extra: {
            quoteId: quote.id,
            fromToken: quote.fromToken.address,
            toToken: quote.toToken.address,
            toChainId: quote.toChainId,
            fromAmount: quote.fromAmount,
            errorMessage: error?.message,
          },
        });
        throw error;
      } finally {
        setIsSending(false);
      }
    },
    [user, safeAA, trackTransaction, queryClient],
  );

  return { swap, isSending };
}

const approve = (token: Address, spender: Address, amount: bigint) => ({
  to: token,
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
  }),
  value: 0n,
});

/**
 * Books the Solid fee once the backend can see the receipt. Best-effort: the
 * fee is already on-chain in LI.FI's FeeCollector, and the call is idempotent,
 * so a lost call only delays the ledger row.
 */
async function bookFee(chainId: number, transactionHash: string) {
  for (let attempt = 1; attempt <= FEE_RECORD_ATTEMPTS; attempt++) {
    try {
      await withRefreshToken(() => recordLifiSwapFee({ chainId, transactionHash }));
      return;
    } catch (error) {
      if (attempt === FEE_RECORD_ATTEMPTS) {
        Sentry.captureException(error, {
          tags: { type: 'lifi_swap_fee_record_failed', chainId },
          extra: { transactionHash },
        });
        return;
      }
      await new Promise(resolve => setTimeout(resolve, FEE_RECORD_BACKOFF_MS * attempt));
    }
  }
}
