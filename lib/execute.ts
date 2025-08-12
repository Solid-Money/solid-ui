import { publicClient } from '@/lib/wagmi';
import { SmartAccountClient } from 'permissionless';
import { getAccountNonce } from 'permissionless/actions';
import { Chain } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';

export const USER_CANCELLED_TRANSACTION = Symbol('USER_CANCELLED_TRANSACTION');

export type TransactionResult = any | typeof USER_CANCELLED_TRANSACTION;

const isWebAuthnUserCancelledError = (error: any): boolean => {
  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('failed to sign') ||
    message.includes('operation either timed out or was not allowed') ||
    message.includes('user cancelled') ||
    message.includes('user denied') ||
    message.includes('user rejected') ||
    message.includes('aborted by the user') ||
    message.includes('not allowed')
  );
};

export const executeTransactions = async (
  smartAccountClient: SmartAccountClient,
  transactions: any[],
  errorMessage: string,
  chain: Chain,
): Promise<TransactionResult> => {
  try {
    const nonce = await getAccountNonce(publicClient(chain.id), {
      address: smartAccountClient.account?.address as `0x`,
      entryPointAddress: entryPoint07Address,
    });

    const transactionHash = await smartAccountClient.sendTransaction({
      calls: transactions,
      nonce,
    });

    const transaction = await publicClient(chain.id).waitForTransactionReceipt({
      hash: transactionHash,
    });

    if (transaction.status !== 'success') {
      throw new Error(errorMessage);
    }

    return transaction;
  } catch (error: any) {
    if (isWebAuthnUserCancelledError(error)) {
      return USER_CANCELLED_TRANSACTION;
    }
    throw error;
  }
};
