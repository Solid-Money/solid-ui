import { useEffect, useState } from "react";
import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  parseSignature,
  parseUnits,
  verifyTypedData,
  type Address
} from "viem";
import { mainnet } from "viem/chains";
import { useAccount, useBlockNumber, useReadContract, useSendTransaction, useSignTypedData } from "wagmi";

import ERC20_ABI from "@/lib/abis/ERC20";
import ETHEREUM_TELLER_ABI from "@/lib/abis/EthereumTeller";
import FiatTokenV2_2 from "@/lib/abis/FiatTokenV2_2";
import { ADDRESSES } from "@/lib/config";
import { Status } from "@/lib/types";
import useUser from "./useUser";

type DepositResult = {
  balance: bigint | undefined;
  deposit: (amount: string) => Promise<void>;
  depositStatus: Status;
  error: string | null;
  hash: Address | undefined;
};

const useDepositFromEOA = (): DepositResult => {
  const { user } = useUser();
  const { address: eoaAddress } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { sendTransactionAsync } = useSendTransaction();

  const [depositStatus, setDepositStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Address | undefined>();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: ERC20_ABI,
    address: ADDRESSES.ethereum.usdc,
    functionName: "balanceOf",
    args: [eoaAddress as Address],
    chainId: mainnet.id,
    query: {
      enabled: !!eoaAddress,
    },
  });

  const { data: fee } = useReadContract({
    abi: ETHEREUM_TELLER_ABI,
    address: ADDRESSES.ethereum.teller,
    functionName: "previewFee",
    args: [
      BigInt(0),
      user?.safeAddress as Address,
      encodeAbiParameters(parseAbiParameters("uint32"), [30138]),
      ADDRESSES.ethereum.nativeFeeToken,
    ],
    chainId: mainnet.id,
    query: {
      enabled: !!user?.safeAddress,
    }
  });

  const { data: nonce } = useReadContract({
    abi: FiatTokenV2_2,
    address: ADDRESSES.ethereum.usdc,
    functionName: 'nonces',
    args: [eoaAddress as Address],
    query: {
      enabled: !!eoaAddress,
    },
  });

  const { data: tokenName } = useReadContract({
    abi: ERC20_ABI,
    address: ADDRESSES.ethereum.usdc,
    functionName: 'name',
    chainId: mainnet.id,
    query: {
      enabled: !!eoaAddress,
    },
  });


  const deposit = async (amount: string) => {
    try {
      if (!eoaAddress) throw new Error("EOA not connected");
      if (nonce === undefined) throw new Error("Could not get nonce");
      if (!tokenName) throw new Error("Could not get token name");
      if (fee === undefined) throw new Error("Could not get fee");
      if (!user?.safeAddress) throw new Error("User safe address not found");

      setDepositStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, 6);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

      const domain = {
        name: tokenName,
        version: '2',
        chainId: mainnet.id,
        verifyingContract: ADDRESSES.ethereum.usdc,
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
        spender: ADDRESSES.ethereum.vault,
        value: amountWei,
        nonce: nonce,
        deadline: deadline,
      };

      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'Permit',
        message,
      });

      const signatureData = parseSignature(signature);

      const verified = await verifyTypedData({
        domain,
        types,
        primaryType: 'Permit',
        message,
        signature,
        address: eoaAddress,
      });

      console.log('verified', verified);

      const callData = encodeFunctionData({
        abi: ETHEREUM_TELLER_ABI,
        functionName: "depositAndBridgeWithPermit",
        args: [
          ADDRESSES.ethereum.usdc,
          amountWei,
          0n,
          deadline,
          Number(signatureData.v),
          signatureData.r,
          signatureData.s,
          user.safeAddress,
          encodeAbiParameters(parseAbiParameters("uint32"), [30138]), // bridgeWildCard
          ADDRESSES.ethereum.nativeFeeToken,
          fee ? fee : 0n,
        ],
      });

      console.log('callData: ', callData);
      const txHash = await sendTransactionAsync({
        to: ADDRESSES.ethereum.teller,
        data: callData,
        value: fee,
      });
      console.log('txHash: ', txHash);

      setHash(txHash);
      setDepositStatus(Status.SUCCESS);
    } catch (error) {
      console.error(error);
      setDepositStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : "Unknown error");
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
  };
};

export default useDepositFromEOA;
