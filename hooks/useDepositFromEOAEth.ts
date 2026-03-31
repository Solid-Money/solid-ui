import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { type Address, encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { useBalance, useBlockNumber, useChainId, useReadContract } from 'wagmi';

import { ERRORS } from '@/constants/errors';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { track, trackIdentity } from '@/lib/analytics';
import { createDeposit } from '@/lib/api';
import { getAttributionChannel } from '@/lib/attribution';
import { ADDRESSES, EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS } from '@/lib/config';
import { getChain } from '@/lib/thirdweb';
import { Status, StatusInfo, TransactionStatus, TransactionType, VaultType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { checkAndSetAllowanceToken, getTransactionReceipt } from '@/lib/utils/contract';
import { useAttributionStore } from '@/store/useAttributionStore';
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

const useDepositFromEOAEth = (
  tokenAddress: Address,
  token: string,
  minimumAmount: string = '0.05',
): DepositResult => {
  const { user } = useUser();
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const chainId = useChainId();
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const eoaAddress = account?.address as Address;
  const updateUser = useUserStore(state => state.updateUser);
  const srcChainId = useDepositStore(state => state.srcChainId);
  const { createActivity, updateActivity } = useActivityActions();

  const isEthereumChain = srcChainId === mainnet.id;
  const isNativeEth = token === 'ETH';

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
    query: {
      enabled: isEthereumChain,
    },
  });

  const { data: erc20Balance, refetch: refetchErc20Balance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [eoaAddress as Address],
    chainId: mainnet.id,
    query: {
      enabled: !!eoaAddress && isEthereumChain && !isNativeEth,
    },
  });

  const { data: nativeBalanceData, refetch: refetchNativeBalance } = useBalance({
    address: eoaAddress as `0x${string}` | undefined,
    chainId: mainnet.id,
    query: {
      enabled: !!eoaAddress && isEthereumChain && isNativeEth,
    },
  });

  const balance = isNativeEth ? nativeBalanceData?.value : erc20Balance;

  const switchChain = async (chainId: number) => {
    try {
      const chain = getChain(chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }
      await wallet?.switchChain(chain);
    } catch (error) {
      throw new Error(`${ERRORS.ERROR_SWITCHING_CHAIN}: ${error}`);
    }
  };

  const createEvent = async (amount: string, spender: Address, token: string) => {
    const clientTxId = await createActivity({
      title: `Deposit ${token}`,
      amount,
      symbol: token,
      chainId: srcChainId,
      fromAddress: eoaAddress,
      toAddress: spender,
      type: TransactionType.DEPOSIT,
    });

    return clientTxId;
  };

  const deposit = async (amount: string) => {
    if (!isEthereumChain) return undefined;

    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);

    let trackingId: string | undefined;
    try {
      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        eoa_address: eoaAddress,
        amount,
        deposit_type: 'connected_wallet',
        deposit_method: 'eth_direct',
        chain_id: srcChainId,
        chain_name: 'ethereum',
        is_sponsor: Number(amount) >= Number(minimumAmount),
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      if (!eoaAddress) {
        const error = new Error('EOA not connected');
        Sentry.captureException(error, {
          tags: {
            operation: 'deposit_from_eoa_eth',
            step: 'validation',
            reason: 'no_eoa_address',
          },
          extra: { amount, srcChainId },
        });
        throw error;
      }

      if (!user?.safeAddress) {
        const error = new Error('User safe address not found');
        Sentry.captureException(error, {
          tags: {
            operation: 'deposit_from_eoa_eth',
            step: 'validation',
            reason: 'no_safe_address',
          },
          extra: { amount, eoaAddress, srcChainId, hasUser: !!user },
        });
        throw error;
      }

      const isSponsor = Number(amount) >= Number(minimumAmount);
      const spender = EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS as Address;

      track(TRACKING_EVENTS.DEPOSIT_VALIDATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        eoa_address: eoaAddress,
        amount,
        is_sponsor: isSponsor,
        chain_id: srcChainId,
        deposit_type: 'connected_wallet',
      });

      setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });
      setError(null);

      Sentry.addBreadcrumb({
        message: 'Starting ETH deposit from EOA',
        category: 'deposit',
        data: {
          amount,
          eoaAddress,
          srcChainId,
          token,
          isSponsor,
        },
      });

      const amountWei = parseUnits(amount, 18);

      let txHash: `0x${string}` | undefined;
      if (token === 'WETH') {
        track(TRACKING_EVENTS.DEPOSIT_TRANSACTION_STARTED, {
          user_id: user?.userId,
          safe_address: user?.safeAddress,
          eoa_address: eoaAddress,
          amount,
          is_sponsor: isSponsor,
          chain_id: srcChainId,
          deposit_type: 'connected_wallet',
          deposit_method: 'eth_direct',
        });

        await switchChain(srcChainId);

        const approvalHash = await checkAndSetAllowanceToken(
          tokenAddress,
          eoaAddress,
          spender,
          amountWei,
          srcChainId,
        );
        if (approvalHash) {
          const receipt = await getTransactionReceipt(srcChainId, approvalHash as `0x${string}`);
          if (!receipt) {
            throw new Error('Failed to get transaction receipt');
          }
          if (receipt.status !== 'success') {
            throw new Error('Transaction failed');
          }
        }

        if (isSponsor) {
          Sentry.addBreadcrumb({
            message: 'Creating sponsored ETH deposit on Ethereum',
            category: 'deposit',
            data: { amount, eoaAddress, isEthereum: true, isSponsor: true },
          });

          trackingId = await createEvent(amount, spender, token);

          setDepositStatus({ status: Status.PENDING, message: 'Processing deposit...' });

          try {
            const result = await withRefreshToken(() =>
              createDeposit({
                eoaAddress,
                amount,
                trackingId,
                vault: VaultType.ETH,
              }),
            );

            if (result?.transactionHash) {
              txHash = result.transactionHash as `0x${string}`;
              updateActivity(trackingId!, {
                status: TransactionStatus.PROCESSING,
                hash: result.transactionHash,
              });
            }

            setHash(txHash);
            updateUser({
              ...user,
              isDeposited: true,
            });

            Sentry.addBreadcrumb({
              message: 'WETH deposit from EOA completed successfully',
              category: 'deposit',
              data: {
                amount,
                transactionHash: txHash,
                eoaAddress,
                userId: user.userId,
                safeAddress: user.safeAddress,
                srcChainId,
                isSponsor,
              },
            });

            track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
              user_id: user?.userId,
              safe_address: user?.safeAddress,
              eoa_address: eoaAddress,
              amount,
              transaction_hash: txHash,
              deposit_type: 'connected_wallet',
              deposit_method: 'eth_direct',
              chain_id: srcChainId,
              chain_name: 'ethereum',
              is_sponsor: isSponsor,
              is_first_deposit: !user?.isDeposited,
              ...attributionData,
              attribution_channel: attributionChannel,
            });

            trackIdentity(user?.userId, {
              last_deposit_amount: parseFloat(amount),
              last_deposit_date: new Date().toISOString(),
              last_deposit_method: 'eth_direct',
              last_deposit_chain: 'ethereum',
              ...attributionData,
              attribution_channel: attributionChannel,
            });

            setDepositStatus({ status: Status.SUCCESS });
          } catch (err) {
            console.error('Sponsored WETH deposit failed:', err);
            updateActivity(trackingId!, {
              status: TransactionStatus.FAILED,
            });
            setDepositStatus({ status: Status.ERROR });
            setError('Sponsored deposit failed');
            throw err;
          }
        } else {
          throw new Error(`Minimum deposit amount is ${minimumAmount} for ETH deposits`);
        }

        return trackingId;
      }

      if (token === 'ETH') {
        track(TRACKING_EVENTS.DEPOSIT_TRANSACTION_STARTED, {
          user_id: user?.userId,
          safe_address: user?.safeAddress,
          eoa_address: eoaAddress,
          amount,
          is_sponsor: isSponsor,
          chain_id: srcChainId,
          deposit_type: 'connected_wallet',
          deposit_method: 'eth_direct',
        });

        await switchChain(srcChainId);

        // Step 1: Wrap ETH → WETH
        setDepositStatus({ status: Status.PENDING, message: 'Wrapping ETH...' });
        const wrapTx = await account?.sendTransaction({
          chainId: mainnet.id,
          to: ADDRESSES.ethereum.weth,
          data: encodeFunctionData({ abi: WETH_ABI, functionName: 'deposit' }),
          value: amountWei,
        });

        const wrapReceipt = await getTransactionReceipt(
          mainnet.id,
          wrapTx?.transactionHash as `0x${string}`,
        );
        if (!wrapReceipt || wrapReceipt.status !== 'success') {
          throw new Error('Failed to wrap ETH to WETH');
        }

        // Step 2: Approve WETH for spender
        setDepositStatus({ status: Status.PENDING, message: 'Approving WETH...' });
        const approvalHash = await checkAndSetAllowanceToken(
          ADDRESSES.ethereum.weth,
          eoaAddress,
          spender,
          amountWei,
          mainnet.id,
        );
        if (approvalHash) {
          const approvalReceipt = await getTransactionReceipt(
            mainnet.id,
            approvalHash as `0x${string}`,
          );
          if (!approvalReceipt || approvalReceipt.status !== 'success') {
            throw new Error('WETH approval failed');
          }
        }

        // Step 3: Sponsored deposit via API (same as WETH flow)
        if (isSponsor) {
          Sentry.addBreadcrumb({
            message: 'Creating sponsored ETH deposit on Ethereum',
            category: 'deposit',
            data: { amount, eoaAddress, isEthereum: true, isSponsor: true },
          });

          trackingId = await createEvent(amount, spender, token);

          setDepositStatus({ status: Status.PENDING, message: 'Processing deposit...' });

          try {
            const result = await withRefreshToken(() =>
              createDeposit({
                eoaAddress,
                amount,
                trackingId,
                vault: VaultType.ETH,
              }),
            );

            if (result?.transactionHash) {
              txHash = result.transactionHash as `0x${string}`;
              updateActivity(trackingId!, {
                status: TransactionStatus.PROCESSING,
                hash: result.transactionHash,
              });
            }

            setHash(txHash);
            updateUser({
              ...user,
              isDeposited: true,
            });

            Sentry.addBreadcrumb({
              message: 'ETH deposit from EOA completed successfully',
              category: 'deposit',
              data: {
                amount,
                transactionHash: txHash,
                eoaAddress,
                userId: user.userId,
                safeAddress: user.safeAddress,
                srcChainId,
                isSponsor,
              },
            });

            track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
              user_id: user?.userId,
              safe_address: user?.safeAddress,
              eoa_address: eoaAddress,
              amount,
              transaction_hash: txHash,
              deposit_type: 'connected_wallet',
              deposit_method: 'eth_direct',
              chain_id: srcChainId,
              chain_name: 'ethereum',
              is_sponsor: isSponsor,
              is_first_deposit: !user?.isDeposited,
              ...attributionData,
              attribution_channel: attributionChannel,
            });

            trackIdentity(user?.userId, {
              last_deposit_amount: parseFloat(amount),
              last_deposit_date: new Date().toISOString(),
              last_deposit_method: 'eth_direct',
              last_deposit_chain: 'ethereum',
              ...attributionData,
              attribution_channel: attributionChannel,
            });

            setDepositStatus({ status: Status.SUCCESS });
          } catch (err) {
            console.error('Sponsored ETH deposit failed:', err);
            updateActivity(trackingId!, {
              status: TransactionStatus.FAILED,
            });
            setDepositStatus({ status: Status.ERROR });
            setError('Sponsored deposit failed');
            throw err;
          }
        } else {
          throw new Error(`Minimum deposit amount is ${minimumAmount} for ETH deposits`);
        }

        return trackingId;
      }
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || 'Unknown error';

      if (trackingId) {
        updateActivity(trackingId, {
          status: TransactionStatus.FAILED,
          metadata: {
            error: errorMessage,
            failedAt: new Date().toISOString(),
          },
        });
      }

      Sentry.captureException(error, {
        tags: {
          operation: 'deposit_from_eoa_eth',
          step: 'execution',
        },
        extra: {
          amount,
          eoaAddress,
          safeAddress: user?.safeAddress,
          srcChainId,
          chainId,
          errorMessage,
          depositStatus,
        },
        user: {
          id: user?.suborgId,
          address: user?.safeAddress,
        },
      });

      track(TRACKING_EVENTS.DEPOSIT_ERROR, {
        amount: amount,
        eoa_address: eoaAddress,
        safe_address: user?.safeAddress,
        src_chain_id: srcChainId,
        chain_id: chainId,
        deposit_status: depositStatus,
        source: 'deposit_from_eoa_eth',
        error: errorMessage,
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      const msg = errorMessage?.toLowerCase();
      let errMsg = '';
      if (
        msg.includes('user rejected') ||
        msg.includes('user denied') ||
        msg.includes('rejected by user') ||
        msg.includes('user cancelled')
      ) {
        errMsg = 'User rejected transaction';
      } else if (errorMessage?.includes(ERRORS.WAIT_TRANSACTION_RECEIPT)) {
        errMsg = ERRORS.WAIT_TRANSACTION_RECEIPT;
      } else if (errorMessage?.includes(ERRORS.ERROR_SWITCHING_CHAIN)) {
        errMsg = ERRORS.ERROR_SWITCHING_CHAIN;
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

export default useDepositFromEOAEth;
