import { useEffect, useState } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  parseSignature,
  parseUnits,
  verifyTypedData,
} from 'viem';
import { mainnet } from 'viem/chains';
import { useBlockNumber, useChainId, useReadContract } from 'wagmi';

import ERC20_ABI from '@/lib/abis/ERC20';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import FiatTokenV2_2 from '@/lib/abis/FiatTokenV2_2';
import { ADDRESSES, EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS } from '@/lib/config';
import { useUserStore } from '@/store/useUserStore';
import useUser from './useUser';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { getChain } from '@/lib/thirdweb';
import { withRefreshToken } from '@/lib/utils';
import { bridgeDeposit } from '@/lib/api';
import { useDepositStore } from '@/store/useDepositStore';

export enum DepositStatus {
  IDLE = 'idle',
  PENDING = 'pending',
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
  fee: bigint | undefined;
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
      if (!eoaAddress) throw new Error('EOA not connected');
      if (nonce === undefined) throw new Error('Could not get nonce');
      if (!tokenName) throw new Error('Could not get token name');
      if (isEthereum && fee === undefined) throw new Error('Could not get fee');
      if (!user?.safeAddress) throw new Error('User safe address not found');

      if (chainId !== srcChainId) {
        const chain = getChain(srcChainId);
        if (!chain) throw new Error('Chain not found');

        await wallet?.switchChain(chain);
      }

      setDepositStatus(DepositStatus.PENDING);
      setError(null);

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
        spender: isEthereum ? ADDRESSES.ethereum.vault : EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS,
        value: amountWei,
        nonce: nonce,
        deadline: deadline,
      };

      const signature = await account?.signTypedData({
        domain,
        types,
        primaryType: 'Permit',
        message,
      });

      const signatureData = parseSignature(signature);

      await verifyTypedData({
        domain,
        types,
        primaryType: 'Permit',
        message,
        signature,
        address: eoaAddress,
      });

      let txHash: Address | undefined;
      if (isEthereum) {
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
        txHash = transaction.transactionHash;
      } else {
        setDepositStatus(DepositStatus.BRIDGING);
        const transaction = await withRefreshToken(() =>
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
        txHash = transaction?.transactionHash;
      }

      setHash(txHash);
      updateUser({
        ...user,
        isDeposited: true,
      });
      setDepositStatus(DepositStatus.SUCCESS);
    } catch (error) {
      console.error(error);
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
    fee,
    isEthereum,
  };
};

export default useDepositFromEOA;
