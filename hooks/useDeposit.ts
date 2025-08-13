import { useEffect, useState } from 'react';
import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  parseUnits,
  TransactionReceipt,
} from 'viem';
import { mainnet } from 'viem/chains';
import { useBlockNumber, useReadContract } from 'wagmi';

import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import ERC20_ABI from '@/lib/abis/ERC20';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions } from '@/lib/execute';
import { Status } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';
import useUser from './useUser';

type DepositResult = {
  allowance: bigint | undefined;
  balance: bigint | undefined;
  approve: (amount: string) => Promise<void>;
  deposit: (amount: string) => Promise<TransactionReceipt>;
  approveStatus: Status;
  depositStatus: Status;
  error: string | null;
};

const useDeposit = (): DepositResult => {
  const { user, safeAA } = useUser();
  const { updateUser } = useUserStore();
  const [approveStatus, setApproveStatus] = useState<Status>(Status.IDLE);
  const [depositStatus, setDepositStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: ERC20_ABI,
    address: ADDRESSES.ethereum.usdc,
    functionName: 'balanceOf',
    args: [user?.safeAddress as Address],
    chainId: mainnet.id,
    query: {
      enabled: !!user?.safeAddress,
    },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: ERC20_ABI,
    address: ADDRESSES.ethereum.usdc,
    functionName: 'allowance',
    args: [user?.safeAddress as Address, ADDRESSES.ethereum.vault],
    chainId: mainnet.id,
    query: {
      enabled: !!user?.safeAddress,
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
  });

  const approve = async (amount: string) => {
    try {
      if (!user?.passkey) {
        throw new Error('Passkey not found');
      }

      setApproveStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, 6);

      const approveTransaction = {
        to: ADDRESSES.ethereum.usdc,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ADDRESSES.ethereum.vault, amountWei],
        }),
        value: 0n,
      };

      const smartAccountClient = await safeAA(user.passkey, mainnet);

      await executeTransactions(
        smartAccountClient,
        user.passkey,
        [approveTransaction],
        'Approval failed',
        mainnet,
      );

      await refetchAllowance();
      setApproveStatus(Status.SUCCESS);
    } catch (error) {
      console.error(error);
      setApproveStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const deposit = async (amount: string) => {
    try {
      if (!user?.passkey) {
        throw new Error('Passkey not found');
      }

      setDepositStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, 6);

      const callData = encodeFunctionData({
        abi: ETHEREUM_TELLER_ABI,
        functionName: 'depositAndBridge',
        args: [
          ADDRESSES.ethereum.usdc,
          amountWei,
          BigInt(0),
          user.safeAddress,
          encodeAbiParameters(parseAbiParameters('uint32'), [30138]),
          ADDRESSES.ethereum.nativeFeeToken,
          fee ? fee : 0n,
        ],
      });

      const transactions = [
        {
          to: ADDRESSES.ethereum.usdc,
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
            args: [ADDRESSES.ethereum.teller, callData, fee ? fee : 0n],
          }),
          value: 0n,
        },
      ];

      const smartAccountClient = await safeAA(user.passkey, mainnet);

      const transaction = await executeTransactions(
        smartAccountClient,
        user.passkey,
        transactions,
        'Deposit failed',
        mainnet,
      );

      updateUser({
        ...user,
        isDeposited: true,
      });
      setDepositStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);
      setDepositStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  useEffect(() => {
    refetchBalance();
  }, [blockNumber]);

  return {
    allowance,
    balance,
    approve,
    deposit,
    approveStatus,
    depositStatus,
    error,
  };
};

export default useDeposit;
