import BoringQueue_ABI from "@/lib/abis/BoringQueue";
import ERC20_ABI from "@/lib/abis/ERC20";
import { ADDRESSES } from "@/lib/config";
import { executeTransactions } from "@/lib/execute";
import { Status } from "@/lib/types";
import { Address } from "abitype";
import { useState } from "react";
import { maxUint256, TransactionReceipt } from "viem";
import { mainnet } from "viem/chains";
import { encodeFunctionData, parseUnits } from "viem/utils";
import { useReadContract } from "wagmi";
import useUser from "./useUser";

type WithdrawResult = {
  withdraw: (amount: string) => Promise<TransactionReceipt>;
  withdrawStatus: Status;
  error: string | null;
};

const useWithdraw = (): WithdrawResult => {
  const { user, safeAA } = useUser();
  const [withdrawStatus, setWithdrawStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const { data: allowance } = useReadContract({
    abi: ERC20_ABI,
    address: ADDRESSES.ethereum.vault,
    functionName: "allowance",
    args: [user?.safeAddress as Address, ADDRESSES.ethereum.boringQueue],
    chainId: mainnet.id,
    query: {
      enabled: !!user?.safeAddress,
    },
  });

  const withdraw = async (amount: string) => {
    try {
      if (!user) {
        throw new Error("User not found");
      }

      setWithdrawStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, 6);

      let transactions = [];

      if ((allowance as bigint) < amountWei) {
        transactions.push({
          to: ADDRESSES.ethereum.vault,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [ADDRESSES.ethereum.boringQueue, maxUint256],
          }),
          value: 0n,
        });
      }

      // Add deposit transaction
      transactions.push({
        to: ADDRESSES.ethereum.boringQueue,
        data: encodeFunctionData({
          abi: BoringQueue_ABI,
          functionName: "requestOnChainWithdraw",
          args: [ADDRESSES.ethereum.usdc, amountWei, 1, 260000],
        }),
        value: 0n,
      });

      const smartAccountClient = await safeAA(mainnet, user.suborgId, user.signWith);

      const transaction = await executeTransactions(
        smartAccountClient,
        transactions,
        "Withdraw failed",
        mainnet
      );

      setWithdrawStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);
      setWithdrawStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : "Unknown error");
      throw error;
    }
  };

  return { withdraw, withdrawStatus, error };
};

export default useWithdraw;
