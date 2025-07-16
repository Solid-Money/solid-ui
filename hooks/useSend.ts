import { Address } from "abitype";
import { useState } from "react";
import { TransactionReceipt } from "viem";
import { encodeFunctionData, parseUnits } from "viem/utils";

import ERC20_ABI from "@/lib/abis/ERC20";
import { executeTransactions } from "@/lib/execute";
import { Status } from "@/lib/types";
import { getChain } from "@/lib/wagmi";
import useUser from "./useUser";

type SendProps = {
  tokenAddress: Address;
  tokenDecimals: number;
  chainId: number;
};

type SendResult = {
  send: (amount: string, to: Address) => Promise<TransactionReceipt>;
  sendStatus: Status;
  error: string | null;
};

const useSend = ({
  tokenAddress,
  tokenDecimals,
  chainId,
}: SendProps): SendResult => {
  const { user, safeAA } = useUser();
  const [sendStatus, setSendStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);
  const chain = getChain(chainId);

  const send = async (amount: string, to: Address) => {
    try {
      if (!user) {
        throw new Error("User not found");
      }

      if (!chain) {
        throw new Error("Chain not found");
      }

      setSendStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, tokenDecimals);

      const transactions = [
        {
          to: tokenAddress,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [to, amountWei],
          }),
          value: 0n,
        },
      ];

      const smartAccountClient = await safeAA(
        chain,
        user.suborgId,
        user.signWith
      );

      const transaction = await executeTransactions(
        smartAccountClient,
        transactions,
        "Send failed",
        chain
      );

      setSendStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);
      setSendStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : "Unknown error");
      throw error;
    }
  };

  return { send, sendStatus, error };
};

export default useSend;
