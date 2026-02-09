import { Address, erc20Abi, Hex, TransactionRequest } from 'viem';
import { readContract, writeContract } from 'wagmi/actions';

import { getUsdcAddress } from '@/constants/bridge';
import { config, getWallet, publicClient } from '@/lib/wagmi';

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
      address: usdcAddress as Address,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
    });

    return hash;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to approve USDC');
  }
};

export const approveToken = async (
  tokenAddress: Address,
  spender: Address,
  amount: bigint,
  chainId: number,
): Promise<string> => {
  try {
    const hash = await writeContract(config, {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
      chainId,
    });

    return hash;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to approve token');
  }
};

export const getUsdcAllowance = async (
  chainId: number,
  owner: Address,
  spender: Address,
): Promise<bigint> => {
  try {
    const usdcAddress = getUsdcAddress(chainId);

    const allowance = (await readContract(config, {
      address: usdcAddress as Address,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, spender],
      chainId,
    })) as bigint;

    return allowance;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to get USDC allowance');
  }
};

export const getTokenAllowance = async (
  tokenAddress: Address,
  ownerAddress: Address,
  spenderAddress: Address,
  chainId: number,
): Promise<bigint> => {
  try {
    const allowance = (await readContract(config, {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [ownerAddress, spenderAddress],
      chainId,
    })) as bigint;

    return allowance;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to get token allowance');
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

export const checkAndSetAllowanceToken = async (
  tokenAddress: Address,
  ownerAddress: Address,
  spenderAddress: Address,
  amount: bigint,
  chainId: number,
): Promise<string | undefined> => {
  const allowance = await getTokenAllowance(tokenAddress, ownerAddress, spenderAddress, chainId);
  if (allowance >= amount) return;

  const hash = await approveToken(tokenAddress, spenderAddress, amount, chainId);
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
