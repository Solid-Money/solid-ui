import { Address, Hex, TransactionRequest } from "viem";
import { readContract, writeContract } from "wagmi/actions";

import { getUsdcAddress } from "@/constants/bridge";
import ERC20ABI from "@/lib/abis/ERC20";
import { config, getWallet, publicClient } from "@/lib/wagmi";

export const getTransactionReceipt = async (chainId: number, hash: Hex) => {
  return publicClient(chainId).waitForTransactionReceipt({
    hash,
  });
};

export const approveUsdc = async (
  chainId: number,
  spender: Address,
  amount: bigint,
): Promise<string> => {
  try {
    const usdcAddress = getUsdcAddress(chainId);

    const hash = await writeContract(config, {
      address: usdcAddress,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [spender, amount],
    });

    return hash;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to approve USDC');
  }
};

export const getUsdcAllowance = async (
  chainId: number,
  owner: Address,
  spender: Address,
): Promise<bigint> => {
  try {
    const usdcAddress = getUsdcAddress(chainId);

    const allowance = await readContract(config, {
      address: usdcAddress,
      abi: ERC20ABI,
      functionName: 'allowance',
      args: [owner, spender],
    }) as bigint;

    return allowance;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to get USDC allowance');
  }
};

export const checkAndSetAllowance = async (
  chainId: number,
  ownerAddress: Address,
  spenderAddress: Address,
  amount: bigint,
): Promise<string | undefined> => {
  const allowance = await getUsdcAllowance(chainId, ownerAddress, spenderAddress);
  if (allowance >= amount) return;

  const hash = await approveUsdc(chainId, spenderAddress, amount);
  return hash;
};

export const sendTransaction = async (chainId: number, transaction: TransactionRequest) => {
  const wallet = await getWallet(chainId);
  const tx = await wallet.sendTransaction(transaction);
  const receipt = await getTransactionReceipt(chainId, tx);

  if (!receipt || receipt.status !== 'success') {
    throw new Error('Failed to send transaction');
  }

  return tx;
};
