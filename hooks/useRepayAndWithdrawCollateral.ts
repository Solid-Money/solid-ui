import { USDC_STARGATE } from '@/constants/addresses';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { AaveV3Pool_ABI } from '@/lib/abis/AaveV3Pool';
import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import { CardDepositManager_ABI } from '@/lib/abis/CardDepositManager';
import { track } from '@/lib/analytics';
import { getStargateQuote } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { StargateQuoteParams, Status, TransactionType } from '@/lib/types';
import { getArbitrumFundingAddress } from '@/lib/utils';
import { publicClient } from '@/lib/wagmi';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { useCallback, useState } from 'react';
import { erc20Abi, pad, TransactionReceipt } from 'viem';
import { readContract } from 'viem/actions';
import { fuse, mainnet } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';
import { useCardDetails } from './useCardDetails';
import { useAaveBorrowPosition } from './useAaveBorrowPosition';
import useUser from './useUser';

// ABI for AccountantWithRateProviders getRate function
const ACCOUNTANT_ABI = [
  {
    inputs: [],
    name: 'getRate',
    outputs: [
      {
        internalType: 'uint256',
        name: 'rate',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

type RepayAndWithdrawCollateralResult = {
  repayAndWithdrawCollateral: (amount: string) => Promise<TransactionReceipt>;
  repayAndWithdrawCollateralStatus: Status;
  error: string | null;
};

const RATE_SCALE = 1_000_000n;
const LIQ_THRESHOLD_BPS = 8_000n; // 80%
const TARGET_HEALTH_FACTOR_BPS = 10_200n; // 1.02x

const useRepayAndWithdrawCollateral = (): RepayAndWithdrawCollateralResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const { data: cardDetails } = useCardDetails();
  const { totalBorrowed, totalSupplied } = useAaveBorrowPosition();
  const [repayAndWithdrawCollateralStatus, setRepayAndWithdrawCollateralStatus] = useState<Status>(
    Status.IDLE,
  );
  const [error, setError] = useState<string | null>(null);

  const repayAndWithdrawCollateral = useCallback(
    async (amountToRepay: string) => {
      try {
        if (!user) {
          const error = new Error('User is not selected');
          Sentry.captureException(error, {
            tags: {
              operation: 'repay_and_withdraw_collateral',
              step: 'validation',
            },
            extra: {
              amount: amountToRepay,
              hasUser: !!user,
            },
          });
          throw error;
        }

        setRepayAndWithdrawCollateralStatus(Status.PENDING);
        setError(null);

        const rate = await readContract(publicClient(mainnet.id), {
          address: ADDRESSES.ethereum.accountant,
          abi: ACCOUNTANT_ABI,
          functionName: 'getRate',
        });

        if (rate === 0n) {
          throw new Error('Invalid soUSD rate');
        }

        const repayAmountWei = parseUnits(amountToRepay, 6);
        const totalBorrowedWei = parseUnits(totalBorrowed.toFixed(6), 6);
        const totalSuppliedSoUSDWei = parseUnits(totalSupplied.toFixed(6), 6);
        const totalSuppliedUsdWei = (totalSuppliedSoUSDWei * rate) / RATE_SCALE;
        const cappedRepayWei =
          repayAmountWei > totalBorrowedWei ? totalBorrowedWei : repayAmountWei;
        const remainingBorrowWei =
          totalBorrowedWei > cappedRepayWei ? totalBorrowedWei - cappedRepayWei : 0n;
        const requiredCollateralValueWei =
          remainingBorrowWei === 0n
            ? 0n
            : (remainingBorrowWei * TARGET_HEALTH_FACTOR_BPS + (LIQ_THRESHOLD_BPS - 1n)) /
              LIQ_THRESHOLD_BPS;
        const currentCollateralValueWei = totalSuppliedUsdWei;
        const withdrawableValueWei =
          currentCollateralValueWei > requiredCollateralValueWei
            ? currentCollateralValueWei - requiredCollateralValueWei
            : 0n;
        const maxWithdrawSoUSDWei = (withdrawableValueWei * RATE_SCALE) / rate;
        const withdrawAmountWei =
          maxWithdrawSoUSDWei > totalSuppliedSoUSDWei ? totalSuppliedSoUSDWei : maxWithdrawSoUSDWei;

        const repayApproveCalldata = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [ADDRESSES.fuse.aaveV3Pool, repayAmountWei],
        });

        const repayCalldata = encodeFunctionData({
          abi: AaveV3Pool_ABI,
          functionName: 'repay',
          args: [USDC_STARGATE, repayAmountWei, 2, user.safeAddress as Address],
        });

        const withdrawCalldata = encodeFunctionData({
          abi: AaveV3Pool_ABI,
          functionName: 'withdraw',
          args: [ADDRESSES.fuse.vault, withdrawAmountWei, user.safeAddress as Address],
        });

        Sentry.addBreadcrumb({
          message: 'Starting bridge to Card transaction',
          category: 'bridge',
          data: {
            amount: amountToRepay,
            amountWei: repayAmountWei.toString(),
            userAddress: user.safeAddress,
            chainId: fuse.id,
          },
        });

        const transactions = [
          {
            to: USDC_STARGATE,
            data: repayApproveCalldata,
            value: 0n,
          },
          {
            to: ADDRESSES.fuse.aaveV3Pool,
            data: repayCalldata,
            value: 0n,
          },
          {
            to: ADDRESSES.fuse.aaveV3Pool,
            data: withdrawCalldata,
            value: 0n,
          },
        ];

        const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

        const result = await trackTransaction(
          {
            type: TransactionType.REPAY_AND_WITHDRAW_COLLATERAL,
            title: `Repay and withdraw collateral`,
            shortTitle: `Repay and withdraw collateral`,
            amount: amountToRepay,
            symbol: 'USDC.e', // Source symbol - bridging USDC.e
            chainId: fuse.id,
            fromAddress: user.safeAddress,
            toAddress: ADDRESSES.fuse.aaveV3Pool,
            metadata: {
              description: `Repay ${amountToRepay} USDC debt and withdraw ${amountToRepay} USDC collateral`,
              sourceSymbol: 'USDC.e', // Track source symbol for display
              tokenAddress: USDC_STARGATE,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Bridge to Card failed',
              fuse,
              onUserOpHash,
            ),
        );

        const transaction_result =
          result && typeof result === 'object' && 'transaction' in result
            ? result.transaction
            : result;

        if (transaction_result === USER_CANCELLED_TRANSACTION) {
          const error = new Error('User cancelled transaction');
          Sentry.captureException(error, {
            tags: {
              operation: 'repay_and_withdraw_collateral',
              step: 'execution',
              reason: 'user_cancelled',
            },
            extra: {
              amount: amountToRepay,
              userAddress: user.safeAddress,
              chainId: fuse.id,
            },
            user: {
              id: user?.userId,
              address: user?.safeAddress,
            },
          });
          throw error;
        }

        Sentry.addBreadcrumb({
          message: 'Repay and withdraw collateral transaction successful',
          category: 'bridge',
          data: {
            amount: amountToRepay,
            transactionHash: transaction_result.transactionHash,
            userAddress: user.safeAddress,
            chainId: fuse.id,
          },
        });

        setRepayAndWithdrawCollateralStatus(Status.SUCCESS);
        return transaction_result;
      } catch (error) {
        console.error(error);

        Sentry.captureException(error, {
          tags: {
            operation: 'repay_and_withdraw_collateral',
            step: 'execution',
          },
          extra: {
            amount: amountToRepay,
            userAddress: user?.safeAddress,
            chainId: fuse.id,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            repayAndWithdrawCollateralStatus,
          },
          user: {
            id: user?.suborgId,
            address: user?.safeAddress,
          },
        });

        setRepayAndWithdrawCollateralStatus(Status.ERROR);
        setError(error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    },
    [
      user,
      cardDetails,
      safeAA,
      trackTransaction,
      repayAndWithdrawCollateralStatus,
      totalBorrowed,
      totalSupplied,
    ],
  );

  return { repayAndWithdrawCollateral, repayAndWithdrawCollateralStatus, error };
};

export default useRepayAndWithdrawCollateral;
