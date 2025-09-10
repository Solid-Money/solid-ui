import * as Sentry from '@sentry/react-native';
import { useEffect, useState } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  parseSignature,
  parseUnits,
  Signature,
  verifyTypedData,
} from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';
import { mainnet } from 'viem/chains';
import { useBlockNumber, useChainId, useReadContract } from 'wagmi';

import { BRIDGE_TOKENS, getUsdcAddress } from '@/constants/bridge';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import ERC20_ABI from '@/lib/abis/ERC20';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import FiatTokenV2_2 from '@/lib/abis/FiatTokenV2_2';
import { track, trackIdentity } from '@/lib/analytics';
import { bridgeDeposit, bridgeTransaction, createDeposit, getLifiQuote } from '@/lib/api';
import { ADDRESSES, EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS, EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import { getChain } from '@/lib/thirdweb';
import { withRefreshToken } from '@/lib/utils';
import { checkAndSetAllowance, sendTransaction } from '@/lib/utils/contract';
import { publicClient } from '@/lib/wagmi';
import { useDepositStore } from '@/store/useDepositStore';
import { useUserStore } from '@/store/useUserStore';
import useUser from './useUser';

export enum DepositStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  DEPOSITING = 'depositing',
  BRIDGING = 'bridging',
  SUCCESS = 'success',
  ERROR = 'error',
}

type DepositResult = {
  balance: bigint | undefined;
  deposit: (amount: string) => Promise<void>;
  depositStatus: DepositStatus;
  error: string | null;
  hash: Address | undefined;
  isEthereum: boolean;
};

const useDepositFromEOA = (): DepositResult => {
  const { user } = useUser();
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const chainId = useChainId();
  const [depositStatus, setDepositStatus] = useState<DepositStatus>(DepositStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const eoaAddress = account?.address;
  const { updateUser } = useUserStore();
  const { srcChainId } = useDepositStore();
  const isEthereum = srcChainId === mainnet.id;

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

  const { data: fee } = useReadContract({
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
    query: {
      enabled: !!user?.safeAddress && !!srcChainId,
    },
  });

  const { data: nonce } = useReadContract({
    abi: FiatTokenV2_2,
    address: BRIDGE_TOKENS[srcChainId]?.tokens?.USDC?.address,
    functionName: 'nonces',
    args: [eoaAddress as Address],
    chainId: srcChainId,
    query: {
      enabled: !!eoaAddress && !!srcChainId,
    },
  });

  const { data: tokenName } = useReadContract({
    abi: ERC20_ABI,
    address: BRIDGE_TOKENS[srcChainId]?.tokens?.USDC?.address,
    functionName: 'name',
    chainId: srcChainId,
    query: {
      enabled: !!eoaAddress && !!srcChainId,
    },
  });

  const deposit = async (amount: string) => {
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

      if (nonce === undefined) {
        const error = new Error('Could not get nonce');
        Sentry.captureException(error, {
          tags: {
            operation: 'deposit_from_eoa',
            step: 'validation',
            reason: 'no_nonce',
          },
          extra: { amount, eoaAddress, srcChainId, isEthereum },
        });
        throw error;
      }

      if (!tokenName) {
        const error = new Error('Could not get token name');
        Sentry.captureException(error, {
          tags: {
            operation: 'deposit_from_eoa',
            step: 'validation',
            reason: 'no_token_name',
          },
          extra: { amount, eoaAddress, srcChainId, isEthereum },
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

      if (!isSponsor && isEthereum && fee === undefined) {
        const error = new Error('Could not get fee');
        Sentry.captureException(error, {
          tags: {
            operation: 'deposit_from_eoa',
            step: 'validation',
            reason: 'no_fee',
          },
          extra: { amount, eoaAddress, srcChainId, isEthereum, isSponsor },
        });
        throw error;
      }

      setDepositStatus(DepositStatus.PENDING);
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

      if (chainId !== srcChainId) {
        const chain = getChain(srcChainId);
        if (!chain) {
          const error = new Error('Chain not found');
          Sentry.captureException(error, {
            tags: {
              operation: 'deposit_from_eoa',
              step: 'chain_switch',
            },
            extra: {
              amount,
              currentChainId: chainId,
              targetChainId: srcChainId,
              eoaAddress,
            },
          });
          throw error;
        }

        Sentry.addBreadcrumb({
          message: 'Switching chain for deposit',
          category: 'deposit',
          data: {
            from: chainId,
            to: srcChainId,
          },
        });

        await wallet?.switchChain(chain);
      }

      const amountWei = parseUnits(amount, 6);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

      const domain = {
        name: tokenName,
        version: '2',
        chainId: srcChainId,
        verifyingContract: BRIDGE_TOKENS[srcChainId]?.tokens?.USDC?.address,
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
        owner: eoaAddress,
        spender: isSponsor ? EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS : ADDRESSES.ethereum.vault,
        value: amountWei,
        nonce: nonce,
        deadline: deadline,
      };

      let signatureData: Signature;
      if (isSponsor || isEthereum) {
        // Track permit signature request
        track(TRACKING_EVENTS.DEPOSIT_PERMIT_REQUESTED, {
          user_id: user?.userId,
          safe_address: user?.safeAddress,
          eoa_address: eoaAddress,
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

        signatureData = parseSignature(signature);

        await verifyTypedData({
          domain,
          types,
          primaryType: 'Permit',
          message,
          signature,
          address: eoaAddress,
        });

        // Track permit signature success
        track(TRACKING_EVENTS.DEPOSIT_PERMIT_SIGNED, {
          user_id: user?.userId,
          safe_address: user?.safeAddress,
          eoa_address: eoaAddress,
          amount,
          is_sponsor: isSponsor,
          chain_id: srcChainId,
          deposit_type: 'connected_wallet',
        });
      }

      let txHash: Address | undefined;
      let transaction: { transactionHash: Address } | undefined = { transactionHash: '' };
      if (isEthereum) {
        setDepositStatus(DepositStatus.DEPOSITING);

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
          fee: fee?.toString(),
        });

        if (isSponsor) {
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
              Number(signatureData!.v),
              signatureData!.r,
              signatureData!.s,
              user.safeAddress,
              encodeAbiParameters(parseAbiParameters('uint32'), [30138]), // bridgeWildCard
              ADDRESSES.ethereum.nativeFeeToken,
              fee ? fee : 0n,
            ],
          });

          transaction = await account?.sendTransaction({
            chainId: mainnet.id,
            to: ADDRESSES.ethereum.teller,
            data: callData,
            value: fee,
          });

          await waitForTransactionReceipt(publicClient(mainnet.id), {
            hash: transaction?.transactionHash as `0x${string}`,
          });
        }
      } else {
        if (isSponsor) {
          setDepositStatus(DepositStatus.BRIDGING);

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

          setDepositStatus(DepositStatus.BRIDGING);

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

          transaction.transactionHash = await sendTransaction(srcChainId, quote.transactionRequest);

          Sentry.addBreadcrumb({
            message: 'Recording bridge transaction',
            category: 'deposit',
            data: {
              bridgeTxHash: transaction?.transactionHash,
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
              bridgeTxHash: transaction?.transactionHash as Address,
            }),
          );
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

      setDepositStatus(DepositStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
          nonce,
          tokenName,
          fee: fee?.toString(),
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
        nonce,
        token_name: tokenName,
        fee: fee?.toString(),
        source: 'deposit_from_eoa',
        error: errorMessage,
      });

      setDepositStatus(DepositStatus.ERROR);
      setError(errorMessage);
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
