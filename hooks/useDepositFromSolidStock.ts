import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type Address, erc20Abi, parseUnits } from 'viem';
import { base } from 'viem/chains';
import { useBlockNumber, useReadContract } from 'wagmi';

import { STOCK_VAULT_MINIMUM_DEPOSIT, type StockVault } from '@/constants/stockVaults';
import { useActivityActions } from '@/hooks/useActivityActions';
import {
  buildStockVaultDepositCalls,
  getStockVaultMinimumMint,
  readStockVaultDepositRate,
} from '@/lib/deposit/stockVault';
import {
  captureDepositError,
  depositBreadcrumb,
  DepositContext,
  trackDepositCompleted,
  trackDepositInitiated,
  trackDepositValidated,
} from '@/lib/deposit/telemetry';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { refreshRewardsAfterSavings } from '@/lib/refreshRewardsAfterSavings';
import { Status, StatusInfo, TransactionStatus, TransactionType } from '@/lib/types';
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserStore } from '@/store/useUserStore';

import useUser from './useUser';

type DepositResult = {
  balance: bigint | undefined;
  deposit: (amount: string) => Promise<string | undefined>;
  depositStatus: StatusInfo;
  error: string | null;
  hash: Address | undefined;
};

const BASE_EXPLORER_URL = base.blockExplorers.default.url;

/**
 * A stock token → its stock vault's shares (AAPLc → soAAPL…) from the Solid wallet
 * (the Safe on Base). The soEURC deposit from the Solid wallet, for whichever stock
 * vault `stock` names: one user operation approving the vault for the amount and
 * depositing through the teller, which mints the shares straight to the Safe.
 *
 * `stock` is undefined while another vault is selected, and the hook then reads
 * nothing and deposits nothing, so the deposit form can call it unconditionally.
 */
const useDepositFromSolidStock = (
  stock: StockVault | undefined,
  minimumAmount: string = STOCK_VAULT_MINIMUM_DEPOSIT,
): DepositResult => {
  const { user, safeAA } = useUser();
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const { createActivity, updateActivity } = useActivityActions();
  const updateUser = useUserStore(state => state.updateUser);

  const safeAddress = user?.safeAddress as Address | undefined;
  const tokenAddress = stock?.stockToken.address;

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: base.id,
    query: {
      enabled: !!stock,
    },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [safeAddress as Address],
    chainId: base.id,
    query: {
      enabled: !!safeAddress && !!tokenAddress,
    },
  });

  const deposit = async (amount: string) => {
    if (!stock) return undefined;
    if (inFlight.current) return undefined;
    inFlight.current = true;
    const symbol = stock.stockToken.symbol;
    const accountSession = useRewardsUpgradeStore.getState().session;
    const assertAccount = async () => {
      if (
        !user?.userId ||
        selectedRewardsUserId() !== user.userId ||
        useRewardsUpgradeStore.getState().session !== accountSession
      )
        throw new Error('Account changed. Reopen the deposit for the selected account.');
    };

    const isSponsor = Number(amount) >= Number(minimumAmount);
    const ctx: DepositContext = {
      user,
      amount,
      chainId: base.id,
      chainName: 'base',
      depositType: 'solid_wallet',
      depositMethod: 'stock_solid_base',
      depositDestination: 'savings',
      isSponsor,
      operation: 'deposit_from_solid_stock',
    };

    let trackingId: string | undefined;
    let cancelled = false;

    try {
      await assertAccount();
      trackDepositInitiated(ctx);

      if (!safeAddress) {
        throw new Error('Solid wallet (Safe) address not found');
      }
      if (!isSponsor) {
        throw new Error(`Minimum deposit amount is ${minimumAmount} ${symbol}`);
      }

      const amountWei = parseUnits(amount, stock.stockToken.decimals);
      if (amountWei <= 0n || balance === undefined || amountWei > balance)
        throw new Error(`Insufficient confirmed ${symbol} balance`);

      trackDepositValidated(ctx);

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      depositBreadcrumb(`Starting ${symbol} deposit from Solid wallet`, {
        amount,
        safeAddress,
        token: symbol,
        vault: stock.shareSymbol,
      });

      // Quote the shares at the teller's current rate and refuse to mint far fewer.
      const rate = await readStockVaultDepositRate(stock);
      const minimumMint = getStockVaultMinimumMint(stock, amountWei, rate);
      const transactions = buildStockVaultDepositCalls(stock, amountWei, minimumMint);

      // A single activity up front, so there is only one entry in the UI.
      trackingId = await createActivity({
        title: `Deposit ${symbol}`,
        amount,
        symbol,
        chainId: base.id,
        fromAddress: safeAddress,
        toAddress: stock.vault,
        type: TransactionType.DEPOSIT,
      });

      const smartAccountClient = await safeAA(base, user!.suborgId, user!.signWith);
      await assertAccount();
      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Deposit failed',
        base,
        userOpHash => {
          updateActivity(trackingId!, { userOpHash });
        },
        assertAccount,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        cancelled = true;
        updateActivity(trackingId, { status: TransactionStatus.CANCELLED });
        throw new Error('User cancelled transaction');
      }

      const txHash =
        result &&
        typeof result === 'object' &&
        result.transaction?.status === 'success' &&
        'transactionHash' in result
          ? (result as { transactionHash: `0x${string}` }).transactionHash
          : undefined;
      if (!txHash) throw new Error(`${symbol} deposit has not been confirmed`);

      // The teller minted in the same transaction: the deposit is complete.
      updateActivity(trackingId, {
        status: TransactionStatus.SUCCESS,
        hash: txHash,
        url: `${BASE_EXPLORER_URL}/tx/${txHash}`,
      });
      setHash(txHash);
      // An old account's receipt must never update the newly selected account (see
      // useDepositFromSolidEur); this hook's own status still ends.
      if (
        selectedRewardsUserId() !== user!.userId ||
        useRewardsUpgradeStore.getState().session !== accountSession
      ) {
        setDepositStatus({ status: Status.SUCCESS });
        return undefined;
      }
      refreshRewardsAfterSavings(queryClient, user!.userId, safeAddress);
      updateUser({ ...user!, isDeposited: true });
      setDepositStatus({ status: Status.SUCCESS });

      depositBreadcrumb(`${symbol} deposit from Solid wallet completed successfully`, {
        amount,
        transactionHash: txHash,
        safeAddress,
      });
      trackDepositCompleted(ctx, { transactionHash: txHash });

      return trackingId;
    } catch (error: any) {
      console.error(error);
      const errMsg = captureDepositError(error, { ...ctx, depositStatus });

      if (trackingId) {
        updateActivity(trackingId, {
          status: cancelled ? TransactionStatus.CANCELLED : TransactionStatus.FAILED,
          metadata: {
            error: error?.message || 'Unknown error',
            failedAt: new Date().toISOString(),
          },
        });
      }

      setDepositStatus({ status: Status.ERROR });
      setError(errMsg);
      throw error;
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    // A refetch runs even while the query is disabled, and there is no token to read then.
    if (tokenAddress && safeAddress) refetchBalance();
  }, [blockNumber, refetchBalance, tokenAddress, safeAddress]);

  return {
    balance,
    deposit,
    depositStatus,
    error,
    hash,
  };
};

export default useDepositFromSolidStock;
