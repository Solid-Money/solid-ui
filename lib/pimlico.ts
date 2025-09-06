import ERC20_ABI from '@/lib/abis/ERC20';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { Address, encodeFunctionData, getAddress } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { mainnet } from 'viem/chains';
import { http } from 'wagmi';
import { ADDRESSES, USER } from './config';
import { getChain } from './wagmi';

export const pimlicoClient = (chainId: number) => {
  const chain = getChain(chainId);
  return createPimlicoClient({
    chain,
    transport: http(USER.pimlicoUrl(chainId)),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7',
    },
  });
};

export const addPaymasterTransaction = async (
  transactions: {
    to: Address;
    data: string;
    value: string;
  }[],
  amount: bigint,
) => {
  const updatedPaymasterTransactions = [
    {
      to: ADDRESSES.ethereum.usdc,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ADDRESSES.ethereum.paymasterAddress, amount],
      }),
      value: '0',
    },
    ...transactions,
  ];
  return updatedPaymasterTransactions;
};

export const getPaymasterQuote = async () => {
  const quotes = await pimlicoClient(mainnet.id).getTokenQuotes({
    tokens: [getAddress(ADDRESSES.ethereum.usdc)],
  });
  //   pimlicoClient.getUserOperationGasPrice;

  const postOpGas: bigint = quotes[0].postOpGas;
  const exchangeRate: bigint = quotes[0].exchangeRate;
  const exchangeRateNativeToUsd: bigint = quotes[0].exchangeRateNativeToUsd;
  const paymaster: Address = quotes[0].paymaster;

  return {
    postOpGas,
    exchangeRate,
    exchangeRateNativeToUsd,
    paymaster,
  };
};

export const estimateGas = async () => {
  const { exchangeRate } = await getPaymasterQuote();

  const userOperationGasPrice = await getUserOperationGasPrice();

  const userOperationMaxGas = BigInt(1260233);

  const userOperationMaxCost = userOperationMaxGas * userOperationGasPrice.standard.maxFeePerGas;

  // represents the userOperation's max cost in token demoniation (wei)
  const maxCostInTokenRaw = (userOperationMaxCost * exchangeRate) / BigInt(1e18);

  return maxCostInTokenRaw;
};

export const getUserOperationGasPrice = async () => {
  const gasPrice = await pimlicoClient(mainnet.id).getUserOperationGasPrice();
  return gasPrice;
};
