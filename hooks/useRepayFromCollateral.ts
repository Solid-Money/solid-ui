import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import {
  Address,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  parseUnits,
  TransactionReceipt,
  zeroAddress,
  zeroHash,
} from 'viem';
import { fuse } from 'viem/chains';

import { USDC_STARGATE } from '@/constants/addresses';
import { useActivityActions } from '@/hooks/useActivityActions';
import useUser from '@/hooks/useUser';
import { AaveV3Pool_ABI } from '@/lib/abis/AaveV3Pool';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';

// Variable-rate AAVE debt mode (1 = stable, 2 = variable). soUSD card borrow uses variable.
const VARIABLE_RATE_MODE = 2n;
// AAVE flashLoanSimple premium = 5 bps (0.05%). Used to cap aToken approval.
const FLASH_LOAN_PREMIUM_BPS = 5n;

type RepayFromCollateralArgs = {
  /** USDC debt to repay (human-readable, e.g. "12.34"). Ignored when `repayAllDebt` is true. */
  debtRepayAmount: string;
  /** soUSD wei to flash-borrow — should be quoted SDK input + execution buffer. */
  collateralAmountWei: bigint;
  /**
   * If true, sets debtRepayAmount = uint256.max and buyAllBalance = true so the
   * adapter clears the user's full debt and withdraws all remaining collateral.
   */
  repayAllDebt?: boolean;
};

type UseRepayFromCollateralResult = {
  repayFromCollateral: (args: RepayFromCollateralArgs) => Promise<TransactionReceipt>;
  status: Status;
  error: string | null;
};

/**
 * Repay USDC.e debt by flash-borrowing soUSD collateral, swapping it on Algebra,
 * and repaying. Triggers Pool.flashLoanSimple → AlgebraAdapter.executeOperation.
 *
 * Why a flash-loan: lets the user repay without holding USDC in wallet — the
 * adapter atomically swaps their collateral and pays down the debt; the user
 * pays only `amountSold + AAVE premium` worth of aSoUSD.
 */
export default function useRepayFromCollateral(): UseRepayFromCollateralResult {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const repayFromCollateral = useCallback(
    async ({
      debtRepayAmount,
      collateralAmountWei,
      repayAllDebt = false,
    }: RepayFromCollateralArgs) => {
      try {
        if (!user) throw new Error('User is not authenticated');
        if (collateralAmountWei <= 0n) throw new Error('Invalid collateral amount');

        setStatus(Status.PENDING);
        setError(null);

        const debtRepayAmountWei = repayAllDebt ? maxUint256 : parseUnits(debtRepayAmount, 6);
        const collateralAmount = collateralAmountWei;

        // Approve aSoUSD for collateralAmount + premium so adapter can pull `amountSold + premium`.
        const aTokenApproveAmount =
          (collateralAmount * (10_000n + FLASH_LOAN_PREMIUM_BPS) + 9_999n) / 10_000n;

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);

        // algebraData = (deployer, deadline, limitSqrtPrice, path)
        // Single-hop soUSD/USDC.e direct pool: empty path → adapter uses exactOutputSingle
        // with deployer=0 (default Algebra pool deployer) and no price limit.
        const algebraData = encodeAbiParameters(
          [
            { name: 'deployer', type: 'address' },
            { name: 'deadline', type: 'uint256' },
            { name: 'limitSqrtPrice', type: 'uint160' },
            { name: 'path', type: 'bytes' },
          ],
          [zeroAddress, deadline, 0n, '0x'],
        );

        // executeOperation params: (debtAsset, debtRepayAmount, buyAllBalance, rateMode, algebraData, permitSig)
        const params = encodeAbiParameters(
          [
            { name: 'debtAsset', type: 'address' },
            { name: 'debtRepayAmount', type: 'uint256' },
            { name: 'buyAllBalance', type: 'bool' },
            { name: 'rateMode', type: 'uint256' },
            { name: 'algebraData', type: 'bytes' },
            {
              name: 'permitSig',
              type: 'tuple',
              components: [
                { name: 'amount', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
                { name: 'v', type: 'uint8' },
                { name: 'r', type: 'bytes32' },
                { name: 's', type: 'bytes32' },
              ],
            },
          ],
          [
            USDC_STARGATE,
            debtRepayAmountWei,
            repayAllDebt,
            VARIABLE_RATE_MODE,
            algebraData,
            { amount: 0n, deadline: 0n, v: 0, r: zeroHash, s: zeroHash },
          ],
        );

        const aTokenApproveCalldata = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [ADDRESSES.fuse.aaveAlgebraAdapter, aTokenApproveAmount],
        });

        const flashLoanCalldata = encodeFunctionData({
          abi: AaveV3Pool_ABI,
          functionName: 'flashLoanSimple',
          args: [
            ADDRESSES.fuse.aaveAlgebraAdapter,
            ADDRESSES.fuse.vault,
            collateralAmount,
            params,
            0,
          ],
        });

        const transactions: { to: Address; data: `0x${string}`; value: bigint }[] = [
          { to: ADDRESSES.fuse.aSoUSD, data: aTokenApproveCalldata, value: 0n },
          { to: ADDRESSES.fuse.aaveV3Pool, data: flashLoanCalldata, value: 0n },
        ];

        // Repay-all path: with no debt remaining, AAVE's HF check passes for any
        // withdrawal, so we sweep the full aSoUSD balance (uint256.max → AAVE
        // withdraws the user's entire aToken supply for soUSD).
        if (repayAllDebt) {
          const withdrawAllCalldata = encodeFunctionData({
            abi: AaveV3Pool_ABI,
            functionName: 'withdraw',
            args: [ADDRESSES.fuse.vault, maxUint256, user.safeAddress as Address],
          });
          transactions.push({
            to: ADDRESSES.fuse.aaveV3Pool,
            data: withdrawAllCalldata,
            value: 0n,
          });
        }

        const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

        const result = await trackTransaction(
          {
            type: TransactionType.REPAY_AND_WITHDRAW_COLLATERAL,
            title: 'Repay from collateral',
            shortTitle: 'Repay from collateral',
            amount: debtRepayAmount,
            symbol: 'USDC',
            chainId: fuse.id,
            fromAddress: user.safeAddress,
            toAddress: ADDRESSES.fuse.aaveV3Pool,
            metadata: {
              description: `Repay ${debtRepayAmount} USDC by swapping soUSD collateral via flash loan`,
              sourceSymbol: 'soUSD',
              tokenAddress: ADDRESSES.fuse.vault,
              collateralAmount: collateralAmount.toString(),
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Repay from collateral failed',
              fuse,
              onUserOpHash,
            ),
        );

        const receipt =
          result && typeof result === 'object' && 'transaction' in result
            ? result.transaction
            : result;

        if (receipt === USER_CANCELLED_TRANSACTION) {
          throw new Error('User cancelled transaction');
        }

        setStatus(Status.SUCCESS);
        return receipt;
      } catch (err) {
        Sentry.captureException(err, {
          tags: { operation: 'repay_from_collateral' },
          extra: {
            debtRepayAmount,
            userAddress: user?.safeAddress,
            chainId: fuse.id,
          },
        });
        setStatus(Status.ERROR);
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      }
    },
    [user, safeAA, trackTransaction],
  );

  return { repayFromCollateral, status, error };
}
