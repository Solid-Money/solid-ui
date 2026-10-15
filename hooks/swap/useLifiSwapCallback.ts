import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SmartAccountClient } from 'permissionless';
import { Address, Chain, encodeFunctionData, erc20Abi, formatUnits } from 'viem';

import { CHAIN_NAMES } from '@/constants/chains';
import { useActivityActions } from '@/hooks/useActivityActions';
import useUser from '@/hooks/useUser';
import { recordLifiSwapFee } from '@/lib/api/lifi-swap';
import { isSponsorshipLimitError } from '@/lib/errors/classify';
import { UserCopyError } from '@/lib/errors/UserCopyError';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { TransactionType } from '@/lib/types';
import { LifiSwapQuote } from '@/lib/types/lifi-swap';
import { withRefreshToken } from '@/lib/utils';
import { generateId } from '@/lib/utils/generate-id';
import { UserOperationGas, userOperationPrefund } from '@/lib/utils/swap/lifi';
import { getChain, publicClient } from '@/lib/wagmi';
import { useLifiSwapStore } from '@/store/lifiSwapStore';
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';

/** Retries for booking the fee: the receipt can lag the bundler's on a fast chain. */
const FEE_RECORD_ATTEMPTS = 4;
const FEE_RECORD_BACKOFF_MS = 5_000;

/** The bundler refusing an unsponsored operation the account can't prefund. */
const PREFUND_SHORTFALL = /\bAA21\b|didn'?t pay prefund|insufficient (?:funds|balance)/i;

export type LifiSwapResult =
  | { kind: 'cancelled' }
  | { kind: 'completed'; transactionHash: `0x${string}` }
  | { kind: 'bridging'; transactionHash: `0x${string}`; clientTxId: string };

export interface LifiSwapOptions {
  /**
   * Pay the source chain's network fee from the Safe instead of our paymaster.
   * Only once the paymaster has refused this swap (see
   * {@link NetworkFeeNotSponsoredError}) and the person has chosen to pay.
   */
  payNetworkFee?: boolean;
}

/**
 * Our paymaster would not sponsor this swap. Its policy caps what one operation
 * may cost at worst, and a LI.FI route out of Ethereum is over that cap: every
 * Ethereum swap failed this way, showing "Invalid parameters were provided to
 * the RPC method". The paymaster answers before the passkey prompt, so nothing
 * was signed or sent; the form offers to pay the fee from the Safe instead.
 */
export class NetworkFeeNotSponsoredError extends Error {
  constructor(
    readonly chainId: number,
    cause: unknown,
  ) {
    super('The network fee for this swap is not sponsored');
    this.name = 'NetworkFeeNotSponsoredError';
    (this as { cause?: unknown }).cause = cause;
  }
}

/**
 * Signs and sends a LI.FI swap from the user's Safe on the source chain.
 *
 * One user operation: an exact approval when the route spends an ERC-20, then
 * LI.FI's call. Solid's fee is inside that call (LI.FI takes it as our
 * integrator fee), so unlike a Fuse swap there is no fee transfer of our own.
 * A first swap on a chain also deploys the Safe there, in the same operation.
 *
 * Gas is sponsored unless `payNetworkFee` is set, when the Safe pays it from
 * its native balance on the source chain.
 */
export function useLifiSwapCallback() {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const queryClient = useQueryClient();
  const [isSending, setIsSending] = useState(false);

  const swap = useCallback(
    async (
      quote: LifiSwapQuote,
      { payNetworkFee = false }: LifiSwapOptions = {},
    ): Promise<LifiSwapResult> => {
      if (!user?.safeAddress || !user.suborgId || !user.signWith)
        throw new UserCopyError('Your wallet is not ready. Reopen the swap and try again.');

      const chain = getChain(quote.fromChainId);
      if (!chain) throw new UserCopyError('This network is not supported for swaps yet.');

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
          throw new UserCopyError('Account changed. Reopen the swap for the selected account.');
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

        const smartAccountClient = await safeAA(chain, user.suborgId, user.signWith, {
          sponsored: !payNetworkFee,
        });
        if (payNetworkFee) {
          await assertCanPayNetworkFee(smartAccountClient, calls, chain, safe, isNativeIn);
        }

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
          void bookFee(quote.fromChainId, transactionHash, quote.fromAmount);
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

        // Answered by the form, which offers to pay the fee. executeTransactions
        // has already reported the paymaster's refusal; not reported twice.
        if (!payNetworkFee && isSponsorshipLimitError(error)) {
          Sentry.addBreadcrumb({
            message: 'LI.FI swap gas not sponsored: policy limit',
            category: 'swap',
            level: 'info',
            data: { fromChainId: quote.fromChainId, quoteId: quote.id },
          });
          throw new NetworkFeeNotSponsoredError(quote.fromChainId, error);
        }
        // Our own copy for a known state (no gas money, account switched).
        if (error instanceof UserCopyError) throw error;

        Sentry.captureException(error, {
          tags: {
            type: 'lifi_swap_execution_failed',
            fromChainId: quote.fromChainId,
            networkFee: payNetworkFee ? 'user' : 'sponsored',
          },
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

/**
 * Before the passkey prompt, check the Safe can pay for its own operation: the
 * EntryPoint takes the worst-case gas cost up front, on top of whatever the
 * calls send (the swapped amount on a native swap, a bridge fee on some
 * routes). Throws user copy when it can't, rather than letting the bundler
 * answer with AA21.
 */
async function assertCanPayNetworkFee(
  client: SmartAccountClient,
  calls: { to: Address; data: `0x${string}`; value: bigint }[],
  chain: Chain,
  safe: Address,
  isNativeIn: boolean,
) {
  const symbol = chain.nativeCurrency.symbol;
  const network = CHAIN_NAMES[chain.id] ?? chain.name;
  // A smaller amount only frees gas money when the amount is the gas token.
  const shortfall = isNativeIn
    ? `Not enough ${symbol} on ${network} to pay the network fee. Lower the amount or add ${symbol}.`
    : `Not enough ${symbol} on ${network} to pay the network fee. Add ${symbol} to swap from ${network}.`;

  let gas: UserOperationGas;
  try {
    const op = await client.prepareUserOperation({ account: client.account!, calls });
    gas = {
      callGasLimit: op.callGasLimit,
      verificationGasLimit: op.verificationGasLimit,
      preVerificationGas: op.preVerificationGas,
      maxFeePerGas: op.maxFeePerGas,
    };
  } catch (error: any) {
    // Some bundlers simulate with the real fees, so an empty Safe fails here.
    if (PREFUND_SHORTFALL.test(`${error?.details ?? ''} ${error?.message ?? ''}`)) {
      throw new UserCopyError(shortfall);
    }
    throw error;
  }

  const sent = calls.reduce((total, call) => total + call.value, 0n);
  const balance = await publicClient(chain.id).getBalance({ address: safe });
  if (balance < userOperationPrefund(gas) + sent) throw new UserCopyError(shortfall);
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
async function bookFee(chainId: number, transactionHash: string, fromAmount: string) {
  for (let attempt = 1; attempt <= FEE_RECORD_ATTEMPTS; attempt++) {
    try {
      await withRefreshToken(() => recordLifiSwapFee({ chainId, transactionHash, fromAmount }));
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
