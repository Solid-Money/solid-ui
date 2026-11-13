import { useEffect, useState } from 'react';
import { type Address, erc20Abi, formatEther, parseUnits } from 'viem';
import { getBalance } from 'viem/actions';
import { base, mainnet } from 'viem/chains';
import { useBlockNumber, useReadContract } from 'wagmi';

import { useActivityActions } from '@/hooks/useActivityActions';
import {
  captureDepositError,
  depositBreadcrumb,
  DepositContext,
  trackDepositCompleted,
  trackDepositInitiated,
} from '@/lib/deposit/telemetry';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import {
  buildSoBtcBaseDepositCalls,
  buildSoBtcEthereumApproveCall,
  buildSoBtcEthereumDepositCall,
  getSoBtcDepositAsset,
  getSoBtcMinimumMint,
  isSoBtcConfigured,
  readSoBtcBridgeFee,
  readSoBtcRate,
  SOBTC_ADDRESSES,
  SOBTC_DECIMALS,
} from '@/lib/soBtc';
import { Status, StatusInfo, TransactionStatus, TransactionType } from '@/lib/types';
import { waitForLayerzeroTransaction } from '@/lib/utils/layerzero';
import { publicClient } from '@/lib/wagmi';
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

/** What executeTransactions throws for a deposit that reverted on chain, and only then. */
const DEPOSIT_REVERTED = 'Deposit failed';

/**
 * WBTC or cbBTC from the Solid wallet into soBTC. The Safe calls the teller itself, in one user
 * operation, and nothing goes through the backend:
 *
 * - cbBTC on Base: approve + `deposit`. The shares mint to the Safe on Base in that transaction.
 * - WBTC on Ethereum: approve + `depositAndBridge`. The WBTC stays in the Ethereum vault and the
 *   shares are sent to the same Safe on Base over LayerZero, so they land a few minutes later.
 *   The LayerZero fee is paid in ETH from the Safe on Ethereum: the paymaster covers gas, not
 *   value, so a Safe without that ETH is told so before anything is signed.
 */
const useDepositFromSolidBtc = (
  tokenAddress: Address,
  token: string,
  minimumAmount: string,
): DepositResult => {
  const { user, safeAA } = useUser();
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const srcChainId = useDepositStore(state => state.srcChainId);
  const { createActivity, updateActivity } = useActivityActions();
  const updateUser = useUserStore(state => state.updateUser);

  const safeAddress = user?.safeAddress as Address | undefined;
  const depositAsset = srcChainId ? getSoBtcDepositAsset(srcChainId) : undefined;
  // Only the asset the chain's vault takes: WBTC on Ethereum, cbBTC on Base.
  const isSoBtcToken = !!depositAsset && tokenAddress?.toLowerCase() === depositAsset.toLowerCase();

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: srcChainId,
    query: { enabled: isSoBtcConfigured && isSoBtcToken },
  });

  const { data: balance, refetch } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [safeAddress as Address],
    chainId: srcChainId,
    query: { enabled: isSoBtcConfigured && isSoBtcToken && !!safeAddress },
  });

  useEffect(() => {
    if (isSoBtcConfigured && isSoBtcToken) refetch();
  }, [blockNumber, isSoBtcToken, refetch]);

  const deposit = async (amount: string) => {
    if (!srcChainId || !isSoBtcToken) return undefined;
    const isEthereum = srcChainId === mainnet.id;
    const chain = isEthereum ? mainnet : base;

    const ctx: DepositContext = {
      user,
      amount,
      chainId: srcChainId,
      chainName: isEthereum ? 'ethereum' : 'base',
      depositType: 'solid_wallet',
      depositMethod: isEthereum ? 'wbtc_solid_ethereum' : 'cbbtc_solid_base',
      depositDestination: 'savings',
      operation: 'deposit_from_solid_btc',
    };

    let trackingId: string | undefined;
    let cancelled = false;
    let sentUserOpHash: string | undefined;

    try {
      trackDepositInitiated(ctx);

      if (!safeAddress) throw new Error('Solid wallet (Safe) address not found');
      if (!isSoBtcConfigured) throw new Error('BTC deposits are not available yet');

      const amountSats = parseUnits(amount, SOBTC_DECIMALS);
      if (amountSats < parseUnits(minimumAmount, SOBTC_DECIMALS)) {
        throw new Error(`Minimum deposit amount is ${minimumAmount} ${token}`);
      }
      if (amountSats <= 0n || balance === undefined || amountSats > balance) {
        throw new Error(`Insufficient ${token} balance`);
      }

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);
      depositBreadcrumb('Starting BTC deposit from Solid wallet', {
        amount,
        safeAddress,
        token,
        srcChainId,
      });

      // Quote the shares at this chain's rate and refuse to mint far fewer.
      const rate = await readSoBtcRate(isEthereum ? mainnet.id : base.id);
      const minimumMint = getSoBtcMinimumMint(amountSats, rate);

      let transactions;
      if (isEthereum) {
        // The fee must be sent exactly, and from the Safe: check it holds that much ETH.
        const fee = await readSoBtcBridgeFee(mainnet.id, base.id, safeAddress);
        const ethBalance = await getBalance(publicClient(mainnet.id), { address: safeAddress });
        if (ethBalance < fee) {
          throw new Error(
            `You need ${Number(formatEther(fee)).toFixed(6)} ETH in your Solid wallet on Ethereum for the bridge fee`,
          );
        }
        transactions = [
          buildSoBtcEthereumApproveCall(amountSats),
          buildSoBtcEthereumDepositCall(amountSats, minimumMint, safeAddress, fee),
        ];
      } else {
        transactions = buildSoBtcBaseDepositCalls(amountSats, minimumMint);
      }

      trackingId = await createActivity({
        title: `Deposit ${token}`,
        amount,
        symbol: token,
        chainId: srcChainId,
        fromAddress: safeAddress,
        toAddress: isEthereum ? SOBTC_ADDRESSES.ethereum.vault : SOBTC_ADDRESSES.base.vault,
        type: TransactionType.DEPOSIT,
      });

      const smartAccountClient = await safeAA(chain, user!.suborgId, user!.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        DEPOSIT_REVERTED,
        chain,
        userOpHash => {
          sentUserOpHash = userOpHash;
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
      if (!txHash) throw new Error('BTC deposit has not been confirmed yet');

      setHash(txHash);
      updateUser({ ...user!, isDeposited: true });
      trackDepositCompleted(ctx, { transactionHash: txHash });

      if (!isEthereum) {
        // The teller minted in the same transaction: the deposit is complete.
        updateActivity(trackingId, {
          status: TransactionStatus.SUCCESS,
          hash: txHash,
          url: `${base.blockExplorers.default.url}/tx/${txHash}`,
        });
        setDepositStatus({ status: Status.SUCCESS });
        return trackingId;
      }

      // WBTC is in the Ethereum vault; the shares are on their way to Base. Processing until
      // LayerZero delivers them, then complete. Not awaited: the form is done once it is sent.
      updateActivity(trackingId, {
        status: TransactionStatus.PROCESSING,
        hash: txHash,
        url: `https://layerzeroscan.com/tx/${txHash}`,
      });
      setDepositStatus({ status: Status.SUCCESS, message: 'soBTC arriving on Base' });
      const id = trackingId;
      waitForLayerzeroTransaction(txHash)
        .then(() =>
          updateActivity(id, {
            status: TransactionStatus.SUCCESS,
            metadata: { layerzeroDeliveredAt: new Date().toISOString() },
          }),
        )
        .catch(err => console.warn('soBTC deposit: LayerZero delivery not confirmed yet', err));
      return trackingId;
    } catch (error: any) {
      console.error(error);
      // Sent, and only the confirmation could not be read: the deposit has most likely landed.
      // Not a failure, or the user deposits again (see useDepositFromSolidEth).
      if (trackingId && sentUserOpHash && error?.message !== DEPOSIT_REVERTED) {
        captureDepositError(error, { ...ctx, depositStatus });
        setDepositStatus({ status: Status.SUCCESS, message: 'Deposit sent, confirming' });
        return trackingId;
      }
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

  return { balance, deposit, depositStatus, error, hash };
};

export default useDepositFromSolidBtc;
