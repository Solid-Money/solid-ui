import { useEffect, useState } from 'react';
import { type Address, erc20Abi, formatEther, parseUnits } from 'viem';
import { getBalance, waitForTransactionReceipt } from 'viem/actions';
import { base, mainnet } from 'viem/chains';
import { useBlockNumber, useReadContract } from 'wagmi';

import { ERRORS } from '@/constants/errors';
import { useActivityActions } from '@/hooks/useActivityActions';
import {
  captureDepositError,
  depositBreadcrumb,
  DepositContext,
  trackDepositCompleted,
  trackDepositInitiated,
} from '@/lib/deposit/telemetry';
import {
  buildSoBtcEthereumDepositCall,
  getSoBtcMinimumMint,
  isSoBtcConfigured,
  readSoBtcBridgeFee,
  readSoBtcRate,
  SOBTC_ADDRESSES,
  SOBTC_DECIMALS,
  WBTC_ETHEREUM,
} from '@/lib/soBtc';
import { getChain } from '@/lib/thirdweb';
import { Status, StatusInfo, TransactionStatus, TransactionType } from '@/lib/types';
import { checkAndSetAllowanceToken, getTransactionReceipt } from '@/lib/utils/contract';
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

/** Why a Base deposit from an external wallet is refused, shown as the form's error. */
export const SOBTC_EOA_BASE_UNSUPPORTED =
  'Deposit cbBTC on Base from your Solid wallet, or WBTC on Ethereum from this wallet';

/**
 * WBTC from a connected external wallet (EOA) on Ethereum into soBTC, with no backend: the
 * wallet approves the Ethereum vault and calls `depositAndBridge` itself, naming the user's
 * Safe on Base as the recipient. The WBTC stays in the Ethereum vault; the shares reach the Safe
 * on Base over LayerZero, whose fee the wallet pays in ETH as the call's value.
 *
 * cbBTC on Base is not taken from an external wallet: the Base teller's `deposit` mints to the
 * caller, which would leave the shares in that wallet rather than the Safe.
 */
const useDepositFromEOABtc = (
  tokenAddress: Address,
  token: string,
  minimumAmount: string,
): DepositResult => {
  const { user } = useUser();
  // Connected external wallet mirrored by the desktop-only ThirdwebConnectionBridge.
  const account = useDepositStore(state => state.externalWallet.account);
  const wallet = useDepositStore(state => state.externalWallet.wallet);
  const srcChainId = useDepositStore(state => state.srcChainId);
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const { createActivity, updateActivity } = useActivityActions();
  const updateUser = useUserStore(state => state.updateUser);

  const eoaAddress = account?.address as Address | undefined;
  const isWbtc =
    srcChainId === mainnet.id && tokenAddress?.toLowerCase() === WBTC_ETHEREUM.toLowerCase();

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
    query: { enabled: isSoBtcConfigured && isWbtc && !!eoaAddress },
  });

  const { data: balance, refetch } = useReadContract({
    abi: erc20Abi,
    address: WBTC_ETHEREUM,
    functionName: 'balanceOf',
    args: [eoaAddress as Address],
    chainId: mainnet.id,
    query: { enabled: isSoBtcConfigured && isWbtc && !!eoaAddress },
  });

  useEffect(() => {
    if (isSoBtcConfigured && isWbtc) refetch();
  }, [blockNumber, isWbtc, refetch]);

  const deposit = async (amount: string) => {
    if (srcChainId === base.id) {
      setError(SOBTC_EOA_BASE_UNSUPPORTED);
      setDepositStatus({ status: Status.ERROR });
      throw new Error(SOBTC_EOA_BASE_UNSUPPORTED);
    }
    if (!isWbtc) return undefined;

    const ctx: DepositContext = {
      user,
      amount,
      chainId: mainnet.id,
      chainName: 'ethereum',
      depositType: 'connected_wallet',
      depositMethod: 'wbtc_direct',
      depositDestination: 'savings',
      operation: 'deposit_from_eoa_btc',
    };

    let trackingId: string | undefined;
    try {
      trackDepositInitiated(ctx);

      if (!eoaAddress || !account) throw new Error('EOA not connected');
      if (!user?.safeAddress) throw new Error('User safe address not found');
      if (!isSoBtcConfigured) throw new Error('BTC deposits are not available yet');

      const amountSats = parseUnits(amount, SOBTC_DECIMALS);
      if (amountSats < parseUnits(minimumAmount, SOBTC_DECIMALS)) {
        throw new Error(`Minimum deposit amount is ${minimumAmount} ${token}`);
      }
      if (amountSats <= 0n || balance === undefined || amountSats > balance) {
        throw new Error('Insufficient WBTC balance');
      }

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);
      depositBreadcrumb('Starting WBTC deposit from EOA', { amount, eoaAddress });

      try {
        const chain = getChain(mainnet.id);
        if (!chain) throw new Error('Chain not found');
        await wallet?.switchChain(chain);
      } catch (switchError) {
        throw new Error(`${ERRORS.ERROR_SWITCHING_CHAIN}: ${switchError}`);
      }

      // The BoringVault pulls the WBTC in `enter`, so the vault is the spender.
      const approvalHash = await checkAndSetAllowanceToken(
        WBTC_ETHEREUM,
        eoaAddress,
        SOBTC_ADDRESSES.ethereum.vault,
        amountSats,
        mainnet.id,
      );
      if (approvalHash) {
        const receipt = await getTransactionReceipt(mainnet.id, approvalHash as `0x${string}`);
        if (receipt?.status !== 'success') throw new Error('Approval failed');
      }

      // Quoted last, right before sending: the teller wants the fee exactly.
      const rate = await readSoBtcRate(mainnet.id);
      const fee = await readSoBtcBridgeFee(mainnet.id, base.id, user.safeAddress as Address);
      const ethBalance = await getBalance(publicClient(mainnet.id), { address: eoaAddress });
      if (ethBalance < fee) {
        throw new Error(
          `You need ${Number(formatEther(fee)).toFixed(6)} ETH plus gas for the bridge fee`,
        );
      }
      const call = buildSoBtcEthereumDepositCall(
        amountSats,
        getSoBtcMinimumMint(amountSats, rate),
        user.safeAddress as Address,
        fee,
      );

      trackingId = await createActivity({
        title: `Deposit ${token}`,
        amount,
        symbol: token,
        chainId: mainnet.id,
        fromAddress: eoaAddress,
        toAddress: SOBTC_ADDRESSES.ethereum.vault,
        type: TransactionType.DEPOSIT,
      });

      const sent = await account.sendTransaction({
        chainId: mainnet.id,
        to: call.to,
        data: call.data,
        value: call.value,
      });
      const txHash = sent?.transactionHash as `0x${string}`;
      setDepositStatus({ status: Status.PENDING, message: 'Depositing' });
      // Keep the hash on the activity from the moment it's broadcast, so a failed receipt read
      // below can never leave a sent deposit without its transaction.
      updateActivity(trackingId, {
        status: TransactionStatus.PROCESSING,
        hash: txHash,
        url: `https://layerzeroscan.com/tx/${txHash}`,
      });
      // A receipt that can't be read is an unknown outcome, not a failure: carry on as sent and
      // let LayerZero delivery settle it. Only a confirmed revert fails the deposit.
      const receipt = await waitForTransactionReceipt(publicClient(mainnet.id), {
        hash: txHash,
      }).catch(receiptError => {
        console.warn('soBTC deposit: receipt not read yet', receiptError);
        return undefined;
      });
      if (receipt && receipt.status !== 'success') throw new Error('Deposit failed');

      setHash(txHash);
      updateUser({ ...user, isDeposited: true });
      trackDepositCompleted(ctx, { transactionHash: txHash });
      // The shares are on their way to Base: processing until LayerZero delivers them.
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

  return { balance, deposit, depositStatus, error, hash };
};

export default useDepositFromEOABtc;
