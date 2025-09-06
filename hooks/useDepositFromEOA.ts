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
import { mainnet } from 'viem/chains';
import { useBlockNumber, useChainId, useReadContract } from 'wagmi';
import { waitForTransactionReceipt } from 'viem/actions';

import ERC20_ABI from '@/lib/abis/ERC20';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import FiatTokenV2_2 from '@/lib/abis/FiatTokenV2_2';
import { ADDRESSES, EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS, EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import { useUserStore } from '@/store/useUserStore';
import useUser from './useUser';
import { BRIDGE_TOKENS, getUsdcAddress } from '@/constants/bridge';
import { getChain } from '@/lib/thirdweb';
import { withRefreshToken } from '@/lib/utils';
import { bridgeDeposit, bridgeTransaction, createDeposit, getLifiQuote } from '@/lib/api';
import { useDepositStore } from '@/store/useDepositStore';
import { publicClient } from '@/lib/wagmi';
import { checkAndSetAllowance, sendTransaction } from '@/lib/utils/contract';

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
          safeAddress: user.safeAddress,
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
      }

      let txHash: Address | undefined;
      let transaction: { transactionHash: Address } | undefined = { transactionHash: '' };
      if (isEthereum) {
        setDepositStatus(DepositStatus.DEPOSITING);
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
          safeAddress: user.safeAddress,
          srcChainId,
          isEthereum,
          isSponsor,
        },
      });
      
      setDepositStatus(DepositStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      
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
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
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
      
      setDepositStatus(DepositStatus.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
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
