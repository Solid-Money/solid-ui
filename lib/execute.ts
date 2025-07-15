import { publicClient } from "@/lib/wagmi";
import { SmartAccountClient } from "permissionless";
import { getAccountNonce } from "permissionless/actions";
import { Chain } from "viem";
import {
  entryPoint07Address
} from "viem/account-abstraction";

export const executeTransactions = async (
  smartAccountClient: SmartAccountClient,
  transactions: any[],
  errorMessage: string,
  chain: Chain
) => {
  const nonce = await getAccountNonce(publicClient(chain.id), {
    address: smartAccountClient.account?.address as `0x`,
    entryPointAddress: entryPoint07Address,
  });

  const transactionHash = await smartAccountClient.sendTransaction({
    calls: transactions,
    nonce,
  })

  const transaction = await publicClient(chain.id).waitForTransactionReceipt({
    hash: transactionHash,
  });

  if (transaction.status !== "success") {
    throw new Error(errorMessage);
  }

  return transaction;
};
