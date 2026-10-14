import { useEffect, useState } from 'react';
import { type Address, erc20Abi, parseUnits } from 'viem';
import { base } from 'viem/chains';
import { useBlockNumber, useReadContract } from 'wagmi';

import { ERRORS } from '@/constants/errors';
import { useActivityActions } from '@/hooks/useActivityActions';
import { createDeposit } from '@/lib/api';
import {
  EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS,
  EXPO_PUBLIC_MINIMUM_EUR_DEPOSIT_AMOUNT,
} from '@/lib/config';
import { SOEURC_DECIMALS } from '@/lib/deposit/soEurc';
import {
  captureDepositError,
  depositBreadcrumb,
  DepositContext,
  trackDepositCompleted,
  trackDepositInitiated,
  trackDepositValidated,
} from '@/lib/deposit/telemetry';
import { getChain } from '@/lib/thirdweb';
import { Status, StatusInfo, TransactionStatus, TransactionType, VaultType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { checkAndSetAllowanceToken, getTransactionReceipt } from '@/lib/utils/contract';
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

/**
 * EURC → soEURC from a connected external wallet (EOA) on Base.
 *
 * Unlike the Solid-wallet deposit this cannot call the teller itself: the teller
 * mints to `msg.sender`, which would leave the shares in the external wallet
 * rather than the user's Safe. So it follows the other connected-wallet vault
 * deposits (WETH, WFUSE): approve the backend's deposit wallet for the EURC, then
 * ask `/accounts/v1/deposit` with `vault: 'eur'` to pull it and deposit it for the
 * Safe. Until the backend accepts `eur` that request fails and the deposit is
 * marked failed with the EURC still in the external wallet — only the approval
 * has happened.
 */
const useDepositFromEOAEur = (
  tokenAddress: Address,
  token: string,
  minimumAmount: string = EXPO_PUBLIC_MINIMUM_EUR_DEPOSIT_AMOUNT,
): DepositResult => {
  const { user } = useUser();
  // Connected external wallet mirrored by the desktop-only ThirdwebConnectionBridge;
  // undefined on mobile (thirdweb is desktop-only). See useDepositFromEOA for details.
  const account = useDepositStore(state => state.externalWallet.account);
  const wallet = useDepositStore(state => state.externalWallet.wallet);
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const eoaAddress = account?.address as Address | undefined;
  const updateUser = useUserStore(state => state.updateUser);
  const srcChainId = useDepositStore(state => state.srcChainId);
  const { createActivity, updateActivity } = useActivityActions();

  const isBaseChain = srcChainId === base.id;
  const isEurc = token === 'EURC';

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: base.id,
    query: {
      enabled: isBaseChain && isEurc && !!eoaAddress,
    },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [eoaAddress as Address],
    chainId: base.id,
    query: {
      enabled: !!eoaAddress && !!tokenAddress && isBaseChain && isEurc,
    },
  });

  const switchToBase = async () => {
    try {
      const chain = getChain(base.id);
      if (!chain) {
        throw new Error('Chain not found');
      }
      await wallet?.switchChain(chain);
    } catch (error) {
      throw new Error(`${ERRORS.ERROR_SWITCHING_CHAIN}: ${error}`);
    }
  };

  const deposit = async (amount: string) => {
    if (!isBaseChain || !isEurc) return undefined;

    const isSponsor = Number(amount) >= Number(minimumAmount);
    const ctx: DepositContext = {
      user,
      amount,
      chainId: srcChainId,
      chainName: 'base',
      depositType: 'connected_wallet',
      depositMethod: 'eurc_direct',
      depositDestination: 'savings',
      isSponsor,
      operation: 'deposit_from_eoa_eur',
    };

    let trackingId: string | undefined;
    try {
      trackDepositInitiated(ctx);

      if (!eoaAddress) {
        throw new Error('EOA not connected');
      }
      if (!user?.safeAddress) {
        throw new Error('User safe address not found');
      }
      if (!isSponsor) {
        throw new Error(`Minimum deposit amount is ${minimumAmount} EURC`);
      }

      const spender = EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS as Address;
      const amountWei = parseUnits(amount, SOEURC_DECIMALS);
      if (amountWei <= 0n || balance === undefined || amountWei > balance)
        throw new Error('Insufficient EURC balance');

      trackDepositValidated(ctx);
      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);
      depositBreadcrumb('Starting EURC deposit from EOA', {
        amount,
        eoaAddress,
        srcChainId,
        token,
      });

      await switchToBase();

      // The backend's deposit wallet pulls the EURC, so it is the spender here.
      const approvalHash = await checkAndSetAllowanceToken(
        tokenAddress,
        eoaAddress,
        spender,
        amountWei,
        base.id,
      );
      if (approvalHash) {
        const receipt = await getTransactionReceipt(base.id, approvalHash as `0x${string}`);
        if (!receipt) {
          throw new Error('Failed to get transaction receipt');
        }
        if (receipt.status !== 'success') {
          throw new Error('Transaction failed');
        }
      }

      trackingId = await createActivity({
        title: `Deposit ${token}`,
        amount,
        symbol: token,
        chainId: base.id,
        fromAddress: eoaAddress,
        toAddress: spender,
        type: TransactionType.DEPOSIT,
      });

      setDepositStatus({ status: Status.PENDING, message: 'Processing deposit...' });

      const result = await withRefreshToken(() =>
        createDeposit({
          eoaAddress,
          amount,
          trackingId,
          vault: VaultType.EUR,
        }),
      );

      const txHash = result?.transactionHash as `0x${string}` | undefined;
      if (txHash) {
        // As in the WFUSE deposit: the backend's protocol hash is also set on the
        // backend's own savings activity, so it is not copied onto this one.
        updateActivity(trackingId, { status: TransactionStatus.PROCESSING });
      }
      setHash(txHash);
      updateUser({ ...user, isDeposited: true });
      setDepositStatus({ status: Status.SUCCESS });

      depositBreadcrumb('EURC deposit from EOA submitted', {
        amount,
        transactionHash: txHash,
        eoaAddress,
      });
      trackDepositCompleted(ctx, { transactionHash: txHash });

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
    refetchBalance();
  }, [blockNumber, refetchBalance]);

  return {
    balance,
    deposit,
    depositStatus,
    error,
    hash,
  };
};

export default useDepositFromEOAEur;
