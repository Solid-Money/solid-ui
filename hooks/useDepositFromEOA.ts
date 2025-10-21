import * as Sentry from '@sentry/react-native';
import { useEffect, useState } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  formatUnits,
  parseAbiParameters,
  parseSignature,
  parseUnits,
  Signature,
  verifyTypedData,
} from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';
import { mainnet } from 'viem/chains';
import { useBlockNumber, useChainId, useReadContract } from 'wagmi';
import { readContract } from "wagmi/actions";

import { BRIDGE_TOKENS, getUsdcAddress } from '@/constants/bridge';
import { ERRORS } from '@/constants/errors';
import { explorerUrls, layerzero, lifi } from '@/constants/explorers';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivity } from '@/hooks/useActivity';
import ERC20_ABI from '@/lib/abis/ERC20';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import FiatTokenV2_2 from '@/lib/abis/FiatTokenV2_2';
import { track, trackIdentity } from '@/lib/analytics';
import { bridgeDeposit, bridgeTransaction, createDeposit, getLifiQuote } from '@/lib/api';
import { ADDRESSES, EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS, EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import { waitForBridgeTransactionReceipt } from '@/lib/lifi';
import { getChain } from '@/lib/thirdweb';
import { Status, StatusInfo, TransactionStatus, TransactionType, User } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { checkAndSetAllowance, sendTransaction } from '@/lib/utils/contract';
import { config, publicClient } from '@/lib/wagmi';
import { useDepositStore } from '@/store/useDepositStore';
import { useUserStore } from '@/store/useUserStore';
import useUser from './useUser';

type DepositResult = {
  balance: bigint | undefined;
  deposit: (amount: string) => Promise<void>;
  depositStatus: StatusInfo;
  error: string | null;
  hash: Address | undefined;
  isEthereum: boolean;
};

const useDepositFromEOA = (): DepositResult => {
  const { user } = useUser();
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const chainId = useChainId();
  const [depositStatus, setDepositStatus] = useState<StatusInfo>({ status: Status.IDLE });
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const eoaAddress = account?.address;
  const { updateUser } = useUserStore();
  const { srcChainId } = useDepositStore();
  const isEthereum = srcChainId === mainnet.id;
  const { createActivity, updateActivity } = useActivity();

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: srcChainId,
    query: {
      enabled: !!srcChainId,
    },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: ERC20_ABI,
    address: BRIDGE_TOKENS[srcChainId]?.tokens?.USDC?.address,
    functionName: 'balanceOf',
    args: [eoaAddress as Address],
    chainId: srcChainId,
    query: {
      enabled: !!eoaAddress && !!srcChainId,
    },
  });

  const getFee = async () => {
    const fee = await readContract(config, {
      abi: ETHEREUM_TELLER_ABI,
      address: ADDRESSES.ethereum.teller,
      functionName: 'previewFee',
      args: [
        BigInt(0),
        user?.safeAddress as Address,
        encodeAbiParameters(parseAbiParameters('uint32'), [30138]),
        ADDRESSES.ethereum.nativeFeeToken,
      ],
      chainId: mainnet.id,
    });

    if (fee === undefined) {
      const error = new Error('Could not get fee');
      Sentry.captureException(error, {
        tags: {
          operation: 'deposit_from_eoa',
          step: 'validation',
          reason: 'no_fee',
        },
        extra: { eoaAddress, chainId: mainnet.id },
      });
      throw error;
    }

    return fee;
  };

  const getNonce = async (chainId: number) => {
    const address = getUsdcAddress(chainId);

    const nonce = await readContract(config, {
      abi: FiatTokenV2_2,
      address,
      functionName: 'nonces',
      args: [eoaAddress as Address],
      chainId,
    });

    if (nonce === undefined) {
      const error = new Error('Could not get nonce');
      Sentry.captureException(error, {
        tags: {
          operation: 'deposit_from_eoa',
          step: 'validation',
          reason: 'no_nonce',
        },
        extra: { eoaAddress, chainId },
      });
      throw error;
    }

    return nonce;
  }

  const getTokenName = async (chainId: number) => {
    const address = getUsdcAddress(chainId);

    const tokenName = await readContract(config, {
      abi: ERC20_ABI,
      address,
      functionName: 'name',
      chainId,
      args: [],
    });


    if (!tokenName) {
      const error = new Error('Could not get token name');
      Sentry.captureException(error, {
        tags: {
          operation: 'deposit_from_eoa',
          step: 'validation',
          reason: 'no_token_name',
        },
        extra: { eoaAddress, chainId },
      });
      throw error;
    }

    return tokenName;
  };

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

  const signPermit = async (owner: Address, spender: Address, amount: string, amountWei: bigint, chainId: number, nonce: bigint, tokenName: string, user: User, isSponsor: boolean) => {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

    const domain = {
      name: tokenName,
      version: '2',
      chainId,
      verifyingContract: getUsdcAddress(chainId),
    };

    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    } as const;

    const message = {
      owner,
      spender,
      value: amountWei,
      nonce: nonce,
      deadline: deadline,
    };

    // Track permit signature request
    track(TRACKING_EVENTS.DEPOSIT_PERMIT_REQUESTED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      eoa_address: owner,
      amount,
      is_sponsor: isSponsor,
      chain_id: srcChainId,
      deposit_type: 'connected_wallet',
    });

    const signature = await account?.signTypedData({
      domain,
      types,
      primaryType: 'Permit',
      message,
    });

    if (!signature) {
      throw new Error('Could not sign permit');
    }

    const signatureData = parseSignature(signature);

    await verifyTypedData({
      domain,
      types,
      primaryType: 'Permit',
      message,
      signature,
      address: owner,
    });

    // Track permit signature success
    track(TRACKING_EVENTS.DEPOSIT_PERMIT_SIGNED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      eoa_address: owner,
      amount,
      is_sponsor: isSponsor,
      chain_id: srcChainId,
      deposit_type: 'connected_wallet',
    });

    return {
      signatureData,
      deadline,
    };
  };

  const depositOnEthereum = async (amount: string, amountWei: bigint, signatureData: Signature, deadline: bigint, user: User, fee: bigint) => {
    setDepositStatus({ status: Status.PENDING, message: 'Check Wallet' });

    Sentry.addBreadcrumb({
      message: 'Executing direct deposit and bridge on Ethereum',
      category: 'deposit',
      data: { amount, eoaAddress, fee: fee?.toString(), isEthereum: true, isSponsor: false },
    });

    const callData = encodeFunctionData({
      abi: ETHEREUM_TELLER_ABI,
      functionName: 'depositAndBridgeWithPermit',
      args: [
        ADDRESSES.ethereum.usdc,
        amountWei,
        0n,
        deadline,
        Number(signatureData.v),
        signatureData.r,
        signatureData.s,
        user.safeAddress,
        encodeAbiParameters(parseAbiParameters('uint32'), [30138]), // bridgeWildCard
        ADDRESSES.ethereum.nativeFeeToken,
        fee ? fee : 0n,
      ],
    });

    const transaction = await account?.sendTransaction({
      chainId: mainnet.id,
      to: ADDRESSES.ethereum.teller,
      data: callData,
      value: fee,
    });

    setDepositStatus({ status: Status.PENDING, message: 'Depositing (takes 2 min)' });

    try {
      await waitForTransactionReceipt(publicClient(mainnet.id), {
        hash: transaction?.transactionHash as `0x${string}`,
      });
    } catch (error) {
      throw new Error(`${ERRORS.WAIT_TRANSACTION_RECEIPT}: ${error}`)
    }

    return transaction;
  };

  const deposit = async (amount: string) => {
    let clientTxId: string | undefined;
    try {
      // Track deposit initiation
      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        eoa_address: eoaAddress,
        amount,
        deposit_type: 'connected_wallet',
        deposit_method: isEthereum ? 'ethereum_direct' : 'cross_chain_bridge',
        chain_id: srcChainId,
        chain_name: isEthereum ? 'ethereum' : BRIDGE_TOKENS[srcChainId]?.name,
        is_sponsor: Number(amount) >= Number(EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT),
      });

      if (!eoaAddress) {
        const error = new Error('EOA not connected');
        Sentry.captureException(error, {
          tags: {
            operation: 'deposit_from_eoa',
            step: 'validation',
            reason: 'no_eoa_address',
          },
          extra: { amount, srcChainId, isEthereum },
        });
        throw error;
      }

      if (!user?.safeAddress) {
        const error = new Error('User safe address not found');
        Sentry.captureException(error, {
          tags: {
            operation: 'deposit_from_eoa',
            step: 'validation',
            reason: 'no_safe_address',
          },
          extra: { amount, eoaAddress, srcChainId, isEthereum, hasUser: !!user },
        });
        throw error;
      }

      const isSponsor = Number(amount) >= Number(EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT);
      const spender = isSponsor ? EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS : ADDRESSES.ethereum.vault;
      const isDeposit = isEthereum || !isSponsor;
      const explorerUrl = isDeposit ? explorerUrls[layerzero.id].layerzeroscan : explorerUrls[lifi.id].lifiscan;

      // Track deposit validation passed
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
        message: 'Starting deposit from EOA',
        category: 'deposit',
        data: {
          amount,
          eoaAddress,
          srcChainId,
          isEthereum,
          isSponsor,
        },
      });

      const amountWei = parseUnits(amount, 6);

      clientTxId = await createActivity({
        title: isDeposit ? 'Staked USDC' : 'Bridge USDC to Ethereum',
        shortTitle: isDeposit ? undefined : 'Bridge USDC',
        amount,
        symbol: isDeposit ? 'soUsd' : 'USDC',
        chainId: srcChainId,
        fromAddress: eoaAddress,
        toAddress: spender,
        type: isDeposit ? TransactionType.DEPOSIT : TransactionType.BRIDGE,
      });

      let txHash: Address | undefined;
      let transaction: { transactionHash: Address } | undefined = { transactionHash: '' };
      if (isEthereum) {
        // Track ethereum deposit start
        track(TRACKING_EVENTS.DEPOSIT_TRANSACTION_STARTED, {
          user_id: user?.userId,
          safe_address: user?.safeAddress,
          eoa_address: eoaAddress,
          amount,
          is_sponsor: isSponsor,
          chain_id: srcChainId,
          deposit_type: 'connected_wallet',
          deposit_method: 'ethereum_direct',
        });

        await switchChain(mainnet.id);
        const nonce = await getNonce(mainnet.id);
        const tokenName = await getTokenName(mainnet.id);

        const { signatureData, deadline } = await signPermit(eoaAddress, spender, amount, amountWei, mainnet.id, nonce, tokenName, user, isSponsor);

        if (isSponsor) {
          setDepositStatus({ status: Status.PENDING, message: 'Depositing (takes 2 min)' });
          Sentry.addBreadcrumb({
            message: 'Creating sponsored deposit on Ethereum',
            category: 'deposit',
            data: { amount, eoaAddress, isEthereum: true, isSponsor: true },
          });

          transaction = await withRefreshToken(() =>
            createDeposit({
              eoaAddress,
              amount,
              permitSignature: {
                v: Number(signatureData.v),
                r: signatureData.r,
                s: signatureData.s,
                deadline: Number(deadline),
              },
            }),
          );
        } else {
          const fee = await getFee();
          transaction = await depositOnEthereum(amount, amountWei, signatureData, deadline, user, fee);
        }
      } else {
        if (isSponsor) {
          const nonce = await getNonce(srcChainId);
          const tokenName = await getTokenName(srcChainId);
          await switchChain(srcChainId);

          const { signatureData, deadline } = await signPermit(eoaAddress, spender, amount, amountWei, srcChainId, nonce, tokenName, user, isSponsor);

          setDepositStatus({ status: Status.PENDING, message: 'Bridging (takes 2 min)' });

          // Track bridge deposit start
          track(TRACKING_EVENTS.DEPOSIT_BRIDGE_STARTED, {
            user_id: user?.userId,
            safe_address: user?.safeAddress,
            eoa_address: eoaAddress,
            amount,
            is_sponsor: isSponsor,
            source_chain_id: srcChainId,
            source_chain_name: BRIDGE_TOKENS[srcChainId]?.name,
            target_chain_id: mainnet.id,
            deposit_type: 'connected_wallet',
            deposit_method: 'cross_chain_bridge',
          });

          Sentry.addBreadcrumb({
            message: 'Creating sponsored bridge deposit',
            category: 'deposit',
            data: { amount, eoaAddress, srcChainId, isEthereum: false, isSponsor: true },
          });

          transaction = await withRefreshToken(() =>
            bridgeDeposit({
              eoaAddress,
              srcChainId,
              amount,
              permitSignature: {
                v: Number(signatureData.v),
                r: signatureData.r,
                s: signatureData.s,
                deadline: Number(deadline),
              },
            }),
          );
        } else {
          Sentry.addBreadcrumb({
            message: 'Getting LiFi quote for bridge transaction',
            category: 'deposit',
            data: { amount, eoaAddress, srcChainId, isEthereum: false, isSponsor: false },
          });

          await switchChain(srcChainId);

          const fromToken = getUsdcAddress(srcChainId);
          const quote = await getLifiQuote({
            fromAddress: eoaAddress,
            fromChain: srcChainId,
            fromAmount: amountWei,
            fromToken,
            toAddress: eoaAddress,
          });

          Sentry.addBreadcrumb({
            message: 'Setting allowance for bridge transaction',
            category: 'deposit',
            data: {
              srcChainId,
              approvalAddress: quote.estimate.approvalAddress,
              fromAmount: quote.estimate.fromAmount,
            },
          });

          await checkAndSetAllowance(
            srcChainId,
            eoaAddress,
            quote.estimate.approvalAddress,
            BigInt(quote.estimate.fromAmount),
          );

          // Track LiFi bridge start
          track(TRACKING_EVENTS.DEPOSIT_BRIDGE_STARTED, {
            user_id: user?.userId,
            safe_address: user?.safeAddress,
            eoa_address: eoaAddress,
            amount,
            is_sponsor: false,
            source_chain_id: srcChainId,
            source_chain_name: BRIDGE_TOKENS[srcChainId]?.name,
            target_chain_id: mainnet.id,
            deposit_type: 'connected_wallet',
            deposit_method: 'lifi_bridge',
            from_amount: quote.estimate.fromAmount,
            to_amount: quote.estimate.toAmount,
          });

          const bridgeTxHash = await sendTransaction(srcChainId, quote.transactionRequest);
          setDepositStatus({ status: Status.PENDING, message: 'Bridging (takes 15 min)' });

          Sentry.addBreadcrumb({
            message: 'Recording bridge transaction',
            category: 'deposit',
            data: {
              bridgeTxHash,
              fromAmount: quote.estimate.fromAmount,
              toAmount: quote.estimate.toAmount,
            },
          });

          await withRefreshToken(() =>
            bridgeTransaction({
              eoaAddress,
              srcChainId,
              amount,
              fromAmount: quote.estimate.fromAmount,
              toAmount: quote.estimate.toAmount,
              toAmountMin: quote.estimate.toAmountMin,
              bridgeTxHash,
            }),
          );

          const bridgeStatus = await waitForBridgeTransactionReceipt(bridgeTxHash);

          await switchChain(mainnet.id);
          const nonce = await getNonce(mainnet.id);
          const tokenName = await getTokenName(mainnet.id);
          const fee = await getFee();

          const bridgeAmountWei = BigInt(bridgeStatus.receiving.amount);
          const bridgeAmount = formatUnits(bridgeAmountWei, 6);

          const { signatureData, deadline } = await signPermit(eoaAddress, spender, bridgeAmount, bridgeAmountWei, mainnet.id, nonce, tokenName, user, isSponsor);

          setDepositStatus({ status: Status.PENDING, message: 'Depositing (takes 2 min)' });
          transaction = await depositOnEthereum(bridgeAmount, bridgeAmountWei, signatureData, deadline, user, fee);
        }
      }

      txHash = transaction?.transactionHash;
      setHash(txHash);
      updateUser({
        ...user,
        isDeposited: true,
      });

      Sentry.addBreadcrumb({
        message: 'Deposit from EOA completed successfully',
        category: 'deposit',
        data: {
          amount,
          transactionHash: txHash,
          eoaAddress,
          userId: user.userId,
          safeAddress: user.safeAddress,
          srcChainId,
          isEthereum,
          isSponsor,
        },
      });

      // Track deposit success
      track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        eoa_address: eoaAddress,
        amount,
        transaction_hash: txHash,
        deposit_type: 'connected_wallet',
        deposit_method: isEthereum ? 'ethereum_direct' : 'cross_chain_bridge',
        chain_id: srcChainId,
        chain_name: isEthereum ? 'ethereum' : BRIDGE_TOKENS[srcChainId]?.name,
        is_sponsor: isSponsor,
        is_first_deposit: !user?.isDeposited,
      });

      trackIdentity(user?.userId, {
        last_deposit_amount: parseFloat(amount),
        last_deposit_date: new Date().toISOString(),
        last_deposit_method: isEthereum ? 'ethereum_direct' : 'cross_chain_bridge',
        last_deposit_chain: isEthereum ? 'ethereum' : BRIDGE_TOKENS[srcChainId]?.name,
      });

      await updateActivity(clientTxId, {
        hash: txHash,
        url: `${explorerUrl}/tx/${txHash}`,
        metadata: {
          substatus: isDeposit ? 'awaiting_deposit' : 'awaiting_bridge',
        },
      });

      setDepositStatus({ status: Status.SUCCESS });
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || 'Unknown error';

      Sentry.captureException(error, {
        tags: {
          operation: 'deposit_from_eoa',
          step: 'execution',
        },
        extra: {
          amount,
          eoaAddress,
          safeAddress: user?.safeAddress,
          srcChainId,
          isEthereum,
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
        is_ethereum: isEthereum,
        chain_id: chainId,
        deposit_status: depositStatus,
        source: 'deposit_from_eoa',
        error: errorMessage,
      });

      const msg = errorMessage?.toLowerCase();
      let status = TransactionStatus.FAILED;
      let errMsg = '';
      if (
        msg.includes('user rejected') ||
        msg.includes('user denied') ||
        msg.includes('rejected by user') ||
        msg.includes('user cancelled')
      ) {
        errMsg = 'User rejected transaction';
        status = TransactionStatus.CANCELLED;
      } else if (errorMessage?.includes(ERRORS.WAIT_TRANSACTION_RECEIPT)) {
        errMsg = ERRORS.WAIT_TRANSACTION_RECEIPT;
      } else if (errorMessage?.includes(ERRORS.ERROR_SWITCHING_CHAIN)) {
        errMsg = ERRORS.ERROR_SWITCHING_CHAIN;
      }

      if (clientTxId) {
        await updateActivity(clientTxId, {
          status,
          metadata: {
            error: errMsg || errorMessage,
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
  }, [blockNumber]);

  return {
    balance,
    deposit,
    depositStatus,
    error,
    hash,
    isEthereum,
  };
};

export default useDepositFromEOA;
