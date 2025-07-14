import BridgePayamster_ABI from "@/lib/abis/BridgePayamster";
import ERC20_ABI from "@/lib/abis/ERC20";
import ETHEREUM_TELLER_ABI from "@/lib/abis/EthereumTeller";
import { ADDRESSES } from "@/lib/config";
import { executeTransactions } from "@/lib/execute";
import { Status } from "@/lib/types";
import { Address } from "abitype";
import { useState } from "react";
import { TransactionReceipt } from "viem";
import { fuse } from "viem/chains";
import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  parseUnits,
} from "viem/utils";
import { useReadContract } from "wagmi";
import useUser from "./useUser";

type BridgeResult = {
  bridge: (amount: string) => Promise<TransactionReceipt>;
  bridgeStatus: Status;
  error: string | null;
};

const useBridgeToMainnet = (): BridgeResult => {
  const { user, safeAA } = useUser();
  const [bridgeStatus, setBridgeStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const { data: balance } = useReadContract({
    abi: ERC20_ABI,
    address: ADDRESSES.fuse.vault,
    functionName: "balanceOf",
    args: [user?.safeAddress as Address],
    chainId: fuse.id,
    query: {
      enabled: !!user?.safeAddress,
    },
  });

  const { data: fee } = useReadContract({
    abi: ETHEREUM_TELLER_ABI,
    address: ADDRESSES.fuse.teller,
    functionName: "previewFee",
    args: [
      BigInt(0),
      user?.safeAddress as Address,
      encodeAbiParameters(parseAbiParameters("uint32"), [30101]),
      ADDRESSES.fuse.nativeFeeToken,
    ],
    chainId: fuse.id,
  });

  const bridge = async (amount: string) => {
    try {
      if (!user?.passkey) {
        throw new Error("Passkey not found");
      }

      setBridgeStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, 6);

      const callData = encodeFunctionData({
        abi: ETHEREUM_TELLER_ABI,
        functionName: "bridge",
        args: [
          amountWei,
          user.safeAddress,
          encodeAbiParameters(parseAbiParameters("uint32"), [30101]),
          ADDRESSES.fuse.nativeFeeToken,
          fee ? fee : 0n,
        ],
      });

      const transactions = [
        {
          to: ADDRESSES.fuse.vault,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [ADDRESSES.fuse.bridgePaymasterAddress, amountWei],
          }),
          value: 0n,
        },
        {
          to: ADDRESSES.fuse.bridgePaymasterAddress,
          data: encodeFunctionData({
            abi: BridgePayamster_ABI,
            functionName: "callWithValue",
            args: [ADDRESSES.fuse.teller, callData, fee ? fee : 0n],
          }),
          value: 0n,
        },
      ];

      const smartAccountClient = await safeAA(user.passkey, fuse);

      const transaction = await executeTransactions(
        smartAccountClient,
        user.passkey,
        transactions,
        "Unstake failed",
        fuse
      );

      setBridgeStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);
      setBridgeStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : "Unknown error");
      throw error;
    }
  };

  return { bridge, bridgeStatus, error };
};

export default useBridgeToMainnet;
