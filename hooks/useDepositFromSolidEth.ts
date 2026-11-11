import { useEffect, useState } from 'react';
import { type Address, encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { base, mainnet } from 'viem/chains';
import { useBalance, useBlockNumber, useReadContract } from 'wagmi';

import { useActivityActions } from '@/hooks/useActivityActions';
import { createDeposit } from '@/lib/api';
import { ADDRESSES, EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS } from '@/lib/config';
import { buildDepositApprovals } from '@/lib/deposit/allowance';
import {
  buildSoEthBaseDepositCalls,
  getSoEthMinimumMint,
  isSoEthBaseConfigured,
  readSoEthBaseDepositRate,
} from '@/lib/deposit/soEthBase';
import {
  captureDepositError,
  depositBreadcrumb,
  DepositContext,
  trackDepositCompleted,
  trackDepositInitiated,
} from '@/lib/deposit/telemetry';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, StatusInfo, TransactionStatus, TransactionType, VaultType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { useUserStore } from '@/store/useUserStore';

import useUser from './useUser';

type DepositResult = {
  balance: bigint | undefined;
  deposit: (amount: string) => Promise<string | undefined>;
  depositStatus: StatusInfo;
  error: string | null;
  hash: Address | undefined;
};

const WETH_ABI = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

const useDepositFromSolidEth = (
  tokenAddress: Address,
  token: string,
  minimumAmount: string = '0.01',
): DepositResult => {
  const { user, safeAA } = useUser();
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const srcChainId = useDepositStore(state => state.srcChainId);
  const { createActivity, updateActivity } = useActivityActions();
  const updateUser = useUserStore(state => state.updateUser);

  const safeAddress = user?.safeAddress as Address | undefined;
  const isNativeEth = token === 'ETH';

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: srcChainId,
    query: {
      enabled: !!srcChainId,
    },
  });

  // ERC20 (WETH) balance
  const { data: erc20Balance, refetch: refetchErc20Balance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [safeAddress as Address],
    chainId: srcChainId,
    query: {
      enabled: !!safeAddress && !!srcChainId && !!tokenAddress && !isNativeEth,
    },
  });

  // Native ETH balance, on the chain the deposit is made from (Ethereum or Base).
  const { data: nativeBalanceData, refetch: refetchNativeBalance } = useBalance({
    address: safeAddress as `0x${string}` | undefined,
    chainId: srcChainId,
    query: {
      enabled: !!safeAddress && !!srcChainId && isNativeEth,
    },
  });

  const balance = isNativeEth ? nativeBalanceData?.value : erc20Balance;

  const createEvent = async (amount: string, spender: Address, tokenSymbol: string) => {
    const clientTxId = await createActivity({
      title: `Deposit ${tokenSymbol}`,
      amount,
      symbol: tokenSymbol,
      chainId: srcChainId,
      fromAddress: safeAddress,
      toAddress: spender,
      type: TransactionType.DEPOSIT,
    });
    return clientTxId;
  };

  // In wei: as numbers, 0.0099999999999999999 rounds up to a 0.01 minimum.
  const meetsMinimum = (amount: string) => {
    try {
      return parseUnits(amount, 18) >= parseUnits(minimumAmount, 18);
    } catch {
      return false;
    }
  };

  /**
   * ETH or WETH on Base: the Safe deposits into the Base soETH teller itself, in one user
   * operation, and the shares mint straight to it, as for soEURC. Nothing goes through the
   * backend, so the deposit is complete once the operation lands.
   */
  const depositOnBase = async (amount: string) => {
    const isSponsor = meetsMinimum(amount);
    const ctx: DepositContext = {
      user,
      amount,
      chainId: base.id,
      chainName: 'base',
      depositType: 'solid_wallet',
      depositMethod: 'eth_solid_base',
      depositDestination: 'savings',
      isSponsor,
      operation: 'deposit_from_solid_eth',
    };

    let trackingId: string | undefined;
    let cancelled = false;

    try {
      trackDepositInitiated(ctx);

      if (!safeAddress) throw new Error('Solid wallet (Safe) address not found');
      if (!isSoEthBaseConfigured) throw new Error('ETH deposits on Base are not available yet');
      if (!isSponsor) throw new Error(`Minimum deposit amount is ${minimumAmount} ETH`);

      const amountWei = parseUnits(amount, 18);
      if (amountWei <= 0n || balance === undefined || amountWei > balance) {
        throw new Error(`Insufficient ${token} balance`);
      }

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);
      depositBreadcrumb('Starting ETH deposit on Base from Solid wallet', {
        amount,
        safeAddress,
        token,
        isNativeEth,
      });

      // Quote the shares at the teller's current rate and refuse to mint far fewer.
      const rate = await readSoEthBaseDepositRate();
      const transactions = buildSoEthBaseDepositCalls(
        amountWei,
        getSoEthMinimumMint(amountWei, rate),
        isNativeEth,
      );

      trackingId = await createActivity({
        title: `Deposit ${token}`,
        amount,
        symbol: token,
        chainId: base.id,
        fromAddress: safeAddress,
        toAddress: ADDRESSES.base.soEthVault,
        type: TransactionType.DEPOSIT,
      });

      const smartAccountClient = await safeAA(base, user!.suborgId, user!.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Deposit failed',
        base,
        userOpHash => {
          updateActivity(trackingId!, { userOpHash });
        },
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
      if (!txHash) throw new Error('ETH deposit on Base has not been confirmed');

      // The teller minted in the same transaction: the deposit is complete.
      updateActivity(trackingId, {
        status: TransactionStatus.SUCCESS,
        hash: txHash,
        url: `${base.blockExplorers.default.url}/tx/${txHash}`,
      });
      setHash(txHash);
      updateUser({ ...user!, isDeposited: true });
      setDepositStatus({ status: Status.SUCCESS });
      trackDepositCompleted(ctx, { transactionHash: txHash });

      return trackingId;
    } catch (error: any) {
      console.error(error);
      const errMsg = captureDepositError(error, { ...ctx, depositStatus });
      if (trackingId && !cancelled) {
        updateActivity(trackingId, {
          status: TransactionStatus.FAILED,
          metadata: {
            error: error?.message || 'Unknown error',
            failedAt: new Date().toISOString(),
          },
        });
      }
      setDepositStatus({ status: Status.ERROR });
      setError(errMsg);
      throw error;
    }
  };

  const deposit = async (amount: string) => {
    if (!token || !srcChainId) return undefined;
    if (srcChainId === base.id) return depositOnBase(amount);

    const isSponsor = meetsMinimum(amount);
    const ctx: DepositContext = {
      user,
      amount,
      chainId: srcChainId,
      chainName: 'ethereum',
      depositType: 'solid_wallet',
      depositMethod: 'eth_solid',
      depositDestination: 'savings',
      isSponsor,
      operation: 'deposit_from_solid_eth',
    };

    let trackingId: string | undefined;

    try {
      trackDepositInitiated(ctx);

      if (!safeAddress) {
        throw new Error('Solid wallet (Safe) address not found');
      }
      if (!isSponsor) {
        throw new Error(`Minimum deposit amount is ${minimumAmount} ETH`);
      }

      const spender = EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS as Address;

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      depositBreadcrumb('Starting ETH deposit from Solid wallet', {
        amount,
        safeAddress,
        srcChainId,
        token,
        isSponsor,
        isNativeEth,
      });

      const amountWei = parseUnits(amount, 18);

      const chain = mainnet;
      const smartAccountClient = await safeAA(chain, user!.suborgId, user!.signWith);

      // Build transactions: for native ETH, wrap first then approve WETH;
      // for WETH, just approve.
      const approvalToken = isNativeEth ? ADDRESSES.ethereum.weth : tokenAddress;
      const approveTransactions = await buildDepositApprovals({
        tokenAddress: approvalToken,
        owner: safeAddress,
        spender,
        amount: amountWei,
        chainId: srcChainId,
      });

      const transactions: { to: Address; data: `0x${string}`; value: bigint }[] = isNativeEth
        ? [
            // Wrap ETH → WETH, then approve the wrapped balance.
            {
              to: ADDRESSES.ethereum.weth,
              data: encodeFunctionData({ abi: WETH_ABI, functionName: 'deposit' }),
              value: amountWei,
            },
            ...approveTransactions,
          ]
        : approveTransactions;

      // Create activity for tracking
      trackingId = await createEvent(amount, spender, token);

      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        isNativeEth ? 'Wrap & Approve failed' : 'Approve failed',
        chain,
        userOpHash => {
          updateActivity(trackingId!, { userOpHash });
        },
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        updateActivity(trackingId, { status: TransactionStatus.CANCELLED });
        throw new Error('User cancelled transaction');
      }

      setDepositStatus({ status: Status.PENDING, message: 'Depositing' });

      if (result && typeof result === 'object' && 'transactionHash' in result) {
        const txHash = (result as { transactionHash: `0x${string}` }).transactionHash;
        setHash(txHash);
        updateActivity(trackingId, {
          status: TransactionStatus.PROCESSING,
          hash: txHash,
        });
      }

      // Call backend to pull tokens from Safe and deposit to vault
      const depositPromise = withRefreshToken(() =>
        createDeposit({
          eoaAddress: safeAddress,
          amount,
          trackingId,
          vault: VaultType.ETH,
        }),
      );

      depositPromise
        .then(result => {
          if (result?.transactionHash) {
            updateActivity(trackingId!, {
              status: TransactionStatus.PROCESSING,
            });
          }
          updateUser({ ...user!, isDeposited: true });
          setDepositStatus({ status: Status.SUCCESS });

          depositBreadcrumb('Deposit from Solid wallet (ETH) completed successfully', {
            amount,
            safeAddress,
            srcChainId,
            isSponsor,
          });

          trackDepositCompleted(ctx);
        })
        .catch(err => {
          console.error('Sponsored Solid ETH deposit failed:', err);
          updateActivity(trackingId!, {
            status: TransactionStatus.PROCESSING,
            metadata: { depositError: err?.message || 'Backend returned error' },
          });
          setDepositStatus({ status: Status.ERROR });
        });

      return trackingId;
    } catch (error: any) {
      console.error(error);
      const errMsg = captureDepositError(error, { ...ctx, depositStatus });

      if (trackingId) {
        updateActivity(trackingId, {
          status: TransactionStatus.FAILED,
          metadata: {
            error: error?.message || 'Unknown error',
            failedAt: new Date().toISOString(),
          },
        });
      }

      setDepositStatus({ status: Status.ERROR });
      setError(errMsg);
      throw error;
    }
  };

  useEffect(() => {
    if (isNativeEth) {
      refetchNativeBalance();
    } else {
      refetchErc20Balance();
    }
  }, [blockNumber, isNativeEth, refetchNativeBalance, refetchErc20Balance]);

  return {
    balance,
    deposit,
    depositStatus,
    error,
    hash,
  };
};

export default useDepositFromSolidEth;
