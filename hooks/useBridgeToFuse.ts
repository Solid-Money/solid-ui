import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import ERC20_ABI from '@/lib/abis/ERC20';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status } from '@/lib/types';
import { Address } from 'abitype';
import { useState } from 'react';
import { TransactionReceipt } from 'viem';
import { mainnet } from 'viem/chains';
import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  parseUnits,
} from 'viem/utils';
import { useReadContract } from 'wagmi';
import useUser from './useUser';

type BridgeResult = {
  bridge: (amount: string) => Promise<TransactionReceipt>;
  bridgeStatus: Status;
  error: string | null;
};

const useBridgeToFuse = (): BridgeResult => {
  const { user, safeAA } = useUser();
  const [bridgeStatus, setBridgeStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

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
  });

  const bridge = async (amount: string) => {
    try {
      if (!user) {
        throw new Error('User is not selected');
      }

      setBridgeStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, 6);

      const callData = encodeFunctionData({
        abi: ETHEREUM_TELLER_ABI,
        functionName: 'bridge',
        args: [
          amountWei,
          user.safeAddress,
          encodeAbiParameters(parseAbiParameters('uint32'), [30138]),
          ADDRESSES.ethereum.nativeFeeToken,
          fee ? fee : 0n,
        ],
      });

      const transactions = [
        {
          to: ADDRESSES.ethereum.vault,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [ADDRESSES.ethereum.bridgePaymasterAddress, amountWei],
          }),
          value: 0n,
        },
        {
          to: ADDRESSES.ethereum.bridgePaymasterAddress,
          data: encodeFunctionData({
            abi: BridgePayamster_ABI,
            functionName: 'callWithValue',
            args: [ADDRESSES.ethereum.teller, '0x05921740', callData, fee ? fee : 0n],
          }),
          value: 0n,
        },
      ];

      const smartAccountClient = await safeAA(mainnet, user.suborgId, user.signWith);

      const transaction = await executeTransactions(
        smartAccountClient,
        transactions,
        'Stake failed',
        mainnet,
      );

      if (transaction === USER_CANCELLED_TRANSACTION) {
        throw new Error('User cancelled transaction');
      }

      setBridgeStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);
      setBridgeStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  return { bridge, bridgeStatus, error };
};

export default useBridgeToFuse;
