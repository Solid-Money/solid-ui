import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { type Address, encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { fuse } from 'viem/chains';
import { useReadContract } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';

import { ALGEBRA_QUOTER_V2, ALGEBRA_ROUTER, USDC_STARGATE, WRAPPED_FUSE } from '@/constants/addresses';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { FastWithdrawManager_ABI } from '@/lib/abis/FastWithdrawManager';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { algebraQuoterV2ABI, algebraRouterABI } from '@/lib/abis';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';

import useUser from './useUser';

/**
 * Vault Switch: soUSD → soFUSE
 *
 * Resolves the chain-mismatch dead-end where withdrawing soUSD returns USDC
 * on Ethereum but swaps are only available on Fuse.
 *
 * Flow (all on Fuse chain):
 *   Step 1 (UserOp 1): FastWithdraw soUSD → USDC_STARGATE on Fuse
 *   Step 2 (UserOp 2): Swap USDC_STARGATE → WFUSE via Algebra + deposit WFUSE → soFUSE
 */

export enum VaultSwitchStep {
  IDLE = 'idle',
  PREVIEWING = 'previewing',
  WITHDRAWING = 'withdrawing',
  SWAPPING_AND_DEPOSITING = 'swapping_and_depositing',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface VaultSwitchPreview {
  /** soUSD input amount (human-readable) */
  soUsdAmount: string;
  /** Estimated USDC output from fast withdraw */
  estimatedUsdcOut: string;
  /** Estimated WFUSE output from swap */
  estimatedWfuseOut: string;
  /** Fast withdraw fee */
  withdrawFee: string;
}

interface VaultSwitchResult {
  /** Preview the conversion amounts before executing */
  preview: (soUsdAmount: string) => Promise<VaultSwitchPreview | null>;
  /** Execute the full vault switch (2 UserOps) */
  execute: (soUsdAmount: string, slippageBps?: number) => Promise<void>;
  /** Current step in the flow */
  step: VaultSwitchStep;
  /** Error message if any */
  error: string | null;
  /** User's soUSD balance on Fuse */
  soUsdBalance: bigint | undefined;
}

const SLIPPAGE_DEFAULT_BPS = 100; // 1% default slippage

const useVaultSwitch = (): VaultSwitchResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction, createActivity, updateActivity } = useActivityActions();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<VaultSwitchStep>(VaultSwitchStep.IDLE);
  const [error, setError] = useState<string | null>(null);

  const safeAddress = user?.safeAddress as Address | undefined;

  // Read soUSD balance on Fuse
  const { data: soUsdBalance } = useReadContract({
    abi: erc20Abi,
    address: ADDRESSES.fuse.vault,
    functionName: 'balanceOf',
    args: [safeAddress as Address],
    chainId: fuse.id,
    query: { enabled: !!safeAddress },
  });

  /**
   * Preview: estimate output amounts for a given soUSD input.
   */
  const preview = useCallback(
    async (soUsdAmount: string): Promise<VaultSwitchPreview | null> => {
      try {
        setStep(VaultSwitchStep.PREVIEWING);
        setError(null);

        const amountWei = parseUnits(soUsdAmount, 6);

        // Step 1: Get estimated USDC output from FastWithdraw
        const client = publicClient(fuse.id);
        const [amountOut, feeAmount] = (await client.readContract({
          address: ADDRESSES.fuse.fastWithdrawManager,
          abi: FastWithdrawManager_ABI,
          functionName: 'previewFastWithdraw',
          args: [ADDRESSES.fuse.stargateOftUSDC, 0n, amountWei],
        })) as [bigint, bigint, bigint];

        // Step 2: Get estimated WFUSE output from Algebra quoter
        const [wfuseOut] = (await client.readContract({
          address: ALGEBRA_QUOTER_V2,
          abi: algebraQuoterV2ABI,
          functionName: 'quoteExactInputSingle',
          args: [
            {
              tokenIn: USDC_STARGATE,
              tokenOut: WRAPPED_FUSE,
              amountIn: amountOut,
              limitSqrtPrice: 0n,
            },
          ],
        })) as [bigint, bigint, bigint, number, bigint, number];

        setStep(VaultSwitchStep.IDLE);

        return {
          soUsdAmount,
          estimatedUsdcOut: (Number(amountOut) / 1e6).toFixed(6),
          estimatedWfuseOut: (Number(wfuseOut) / 1e18).toFixed(4),
          withdrawFee: (Number(feeAmount) / 1e6).toFixed(6),
        };
      } catch (err) {
        console.error('Vault switch preview failed:', err);
        setStep(VaultSwitchStep.ERROR);
        setError(err instanceof Error ? err.message : 'Preview failed');
        return null;
      }
    },
    [],
  );

  /**
   * Execute the full vault switch flow.
   *
   * UserOp 1: Approve soUSD + FastWithdraw soUSD → USDC on Fuse
   * UserOp 2: Approve USDC + Swap USDC → WFUSE + Approve WFUSE + Deposit WFUSE → soFUSE
   */
  const execute = useCallback(
    async (soUsdAmount: string, slippageBps: number = SLIPPAGE_DEFAULT_BPS) => {
      if (!user || !safeAddress) {
        throw new Error('User not authenticated');
      }

      setError(null);

      const amountWei = parseUnits(soUsdAmount, 6);

      try {
        // ── Step 1: Fast Withdraw soUSD → USDC on Fuse ──────────────
        setStep(VaultSwitchStep.WITHDRAWING);

        track(TRACKING_EVENTS.VAULT_SWITCH_INITIATED, {
          amount: soUsdAmount,
          from_vault: 'soUSD',
          to_vault: 'soFUSE',
          source: 'useVaultSwitch',
        });

        const withdrawTxs = [
          // Approve soUSD to FastWithdrawManager
          {
            to: ADDRESSES.fuse.vault,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [ADDRESSES.fuse.fastWithdrawManager, amountWei],
            }),
            value: 0n,
          },
          // FastWithdraw soUSD → USDC (sent to user's Safe on Fuse)
          {
            to: ADDRESSES.fuse.fastWithdrawManager,
            data: encodeFunctionData({
              abi: FastWithdrawManager_ABI,
              functionName: 'swapAndWithdraw',
              args: [
                ADDRESSES.fuse.stargateOftUSDC as Address,
                safeAddress as Address,
                amountWei,
                safeAddress as Address, // USDC goes back to user's Safe on Fuse
              ],
            }),
            value: 0n,
          },
        ];

        const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

        const withdrawResult = await trackTransaction(
          {
            type: TransactionType.VAULT_SWITCH,
            title: 'Switch soUSD → soFUSE (withdraw)',
            shortTitle: 'soUSD → USDC',
            amount: soUsdAmount,
            symbol: 'soUSD',
            chainId: fuse.id,
            fromAddress: safeAddress,
            toAddress: ADDRESSES.fuse.fastWithdrawManager,
            metadata: {
              description: `Withdraw ${soUsdAmount} soUSD to USDC on Fuse`,
              step: 'withdraw',
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              withdrawTxs,
              'Vault switch withdraw failed',
              fuse,
              onUserOpHash,
            ),
        );

        if (withdrawResult === USER_CANCELLED_TRANSACTION) {
          track(TRACKING_EVENTS.VAULT_SWITCH_CANCELLED, {
            amount: soUsdAmount,
            step: 'withdraw',
            source: 'useVaultSwitch',
          });
          setStep(VaultSwitchStep.IDLE);
          return;
        }

        // ── Get actual USDC balance for step 2 ─────────────────────
        // Read the actual USDC_STARGATE balance after the withdraw
        const client = publicClient(fuse.id);
        const usdcBalance = (await client.readContract({
          address: USDC_STARGATE,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [safeAddress],
        })) as bigint;

        if (usdcBalance === 0n) {
          throw new Error('No USDC received from withdrawal');
        }

        // ── Step 2: Swap USDC → WFUSE + Deposit WFUSE → soFUSE ────
        setStep(VaultSwitchStep.SWAPPING_AND_DEPOSITING);

        // Get swap quote for the actual USDC amount
        const [estimatedWfuseOut] = (await client.readContract({
          address: ALGEBRA_QUOTER_V2,
          abi: algebraQuoterV2ABI,
          functionName: 'quoteExactInputSingle',
          args: [
            {
              tokenIn: USDC_STARGATE,
              tokenOut: WRAPPED_FUSE,
              amountIn: usdcBalance,
              limitSqrtPrice: 0n,
            },
          ],
        })) as [bigint, bigint, bigint, number, bigint, number];

        // Apply slippage to get minimum output
        const minWfuseOut = (estimatedWfuseOut * BigInt(10000 - slippageBps)) / 10000n;

        // Build the swap calldata for Algebra router (exactInputSingle)
        const swapCalldata = encodeFunctionData({
          abi: algebraRouterABI,
          functionName: 'exactInputSingle',
          args: [
            {
              tokenIn: USDC_STARGATE,
              tokenOut: WRAPPED_FUSE,
              deployer: '0x0000000000000000000000000000000000000000' as Address,
              recipient: safeAddress,
              deadline: BigInt(Math.floor(Date.now() / 1000) + 1800), // 30 min
              amountIn: usdcBalance,
              amountOutMinimum: minWfuseOut,
              limitSqrtPrice: 0n,
            },
          ],
        });

        const swapAndDepositTxs = [
          // 1. Approve USDC_STARGATE to Algebra Router
          {
            to: USDC_STARGATE as Address,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [ALGEBRA_ROUTER, usdcBalance],
            }),
            value: 0n,
          },
          // 2. Swap USDC → WFUSE via Algebra
          {
            to: ALGEBRA_ROUTER as Address,
            data: swapCalldata,
            value: 0n,
          },
          // 3. Approve WFUSE to soFUSE vault (use estimated + buffer since exact output unknown)
          {
            to: WRAPPED_FUSE as Address,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [ADDRESSES.fuse.fuseVault, estimatedWfuseOut * 2n],
            }),
            value: 0n,
          },
          // 4. Deposit WFUSE → soFUSE via fuseTeller (minimumMint = 0 to accept any share amount)
          {
            to: ADDRESSES.fuse.fuseTeller,
            data: encodeFunctionData({
              abi: ETHEREUM_TELLER_ABI,
              functionName: 'deposit',
              args: [WRAPPED_FUSE, minWfuseOut, 0n],
            }),
            value: 0n,
          },
        ];

        // Reuse the same SmartAccountClient (same session)
        const smartAccountClient2 = await safeAA(fuse, user.suborgId, user.signWith);

        const swapResult = await trackTransaction(
          {
            type: TransactionType.VAULT_SWITCH,
            title: 'Switch soUSD → soFUSE (swap & deposit)',
            shortTitle: 'USDC → soFUSE',
            amount: (Number(usdcBalance) / 1e6).toFixed(2),
            symbol: 'USDC',
            chainId: fuse.id,
            fromAddress: safeAddress,
            toAddress: ADDRESSES.fuse.fuseTeller,
            metadata: {
              description: `Swap USDC to WFUSE and deposit into soFUSE vault`,
              step: 'swap_and_deposit',
              estimatedWfuseOut: estimatedWfuseOut.toString(),
              minWfuseOut: minWfuseOut.toString(),
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient2,
              swapAndDepositTxs,
              'Vault switch swap & deposit failed',
              fuse,
              onUserOpHash,
            ),
        );

        if (swapResult === USER_CANCELLED_TRANSACTION) {
          track(TRACKING_EVENTS.VAULT_SWITCH_CANCELLED, {
            amount: soUsdAmount,
            step: 'swap_and_deposit',
            source: 'useVaultSwitch',
          });
          // Partial completion: USDC is in the Safe, user can retry step 2
          setStep(VaultSwitchStep.IDLE);
          setError('Swap cancelled. Your USDC is in your wallet — you can swap manually or retry.');
          return;
        }

        // ── Success ────────────────────────────────────────────────
        track(TRACKING_EVENTS.VAULT_SWITCH_COMPLETED, {
          amount: soUsdAmount,
          from_vault: 'soUSD',
          to_vault: 'soFUSE',
          source: 'useVaultSwitch',
        });

        // Refresh all balance queries
        queryClient.invalidateQueries({ queryKey: ['balance'] });
        queryClient.invalidateQueries({ queryKey: ['tokenBalances'] });
        queryClient.invalidateQueries({ queryKey: ['readContract'] });

        setStep(VaultSwitchStep.SUCCESS);
      } catch (err) {
        console.error('Vault switch failed:', err);

        track(TRACKING_EVENTS.VAULT_SWITCH_FAILED, {
          amount: soUsdAmount,
          step,
          error: err instanceof Error ? err.message : 'Unknown error',
          source: 'useVaultSwitch',
        });

        Sentry.captureException(err, {
          tags: { operation: 'vault_switch', step },
          extra: {
            soUsdAmount,
            safeAddress,
            slippageBps,
          },
          user: { id: user?.suborgId, address: safeAddress },
        });

        setStep(VaultSwitchStep.ERROR);
        setError(err instanceof Error ? err.message : 'Vault switch failed');
        throw err;
      }
    },
    [user, safeAddress, safeAA, trackTransaction, queryClient, step],
  );

  return {
    preview,
    execute,
    step,
    error,
    soUsdBalance,
  };
};

export default useVaultSwitch;
