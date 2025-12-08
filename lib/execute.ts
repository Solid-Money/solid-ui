import { publicClient } from '@/lib/wagmi';
import * as Sentry from '@sentry/react-native';
import { SmartAccountClient } from 'permissionless';
import { getAccountNonce } from 'permissionless/actions';
import { Chain } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';

export const USER_CANCELLED_TRANSACTION = Symbol('USER_CANCELLED_TRANSACTION');

export type TransactionResult = {
  transaction: any;
  userOpHash: `0x${string}`;
  transactionHash: string;
} | typeof USER_CANCELLED_TRANSACTION;

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

const isUserOperationError = (error: any): boolean => {
  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('useroperation reverted') ||
    message.includes('simulate validation result') ||
    message.includes('paymaster') ||
    message.includes('execution reverted')
  );
};

export const getTransaction = (result: TransactionResult): TransactionResult => {
  return result && typeof result === 'object' && 'transaction' in result
    ? result.transaction
    : result;
}

export const executeTransactions = async (
  smartAccountClient: SmartAccountClient,
  transactions: any[],
  errorMessage: string,
  chain: Chain,
  onUserOpHash?: (userOpHash: `0x${string}`) => void,
): Promise<TransactionResult> => {
  let userOpHash: `0x${string}` | undefined;

  try {
    const nonce = await getAccountNonce(publicClient(chain.id), {
      address: smartAccountClient.account?.address as `0x`,
      entryPointAddress: entryPoint07Address,
    });

    // Add breadcrumb for transaction attempt
    Sentry.addBreadcrumb({
      message: 'Attempting transaction execution',
      category: 'transaction',
      level: 'info',
      data: {
        chainId: chain.id,
        transactionCount: transactions.length,
      },
    });

    // Get userOpHash immediately
    userOpHash = await smartAccountClient.sendUserOperation({
      calls: transactions,
      nonce,
    });

    console.log('UserOp Hash (immediate):', userOpHash);

    // Call the callback immediately with userOpHash (before waiting for receipt)
    if (onUserOpHash && userOpHash) {
      onUserOpHash(userOpHash);
    }

    // Add breadcrumb with userOpHash
    Sentry.addBreadcrumb({
      message: 'UserOperation submitted',
      category: 'transaction',
      level: 'info',
      data: {
        userOpHash,
        chainId: chain.id,
      },
    });

    // Wait for the UserOperation to be included in a block and get the transaction hash
    const receipt = await smartAccountClient.waitForUserOperationReceipt({
      hash: userOpHash as `0x${string}`,
    });

    console.log('Receipt:', receipt);

    const transactionHash = receipt.receipt.transactionHash;

    console.log('Transaction Hash:', transactionHash);
    // Get the full transaction receipt
    const transaction = await publicClient(chain.id).waitForTransactionReceipt({
      hash: transactionHash,
    });

    console.log('Transaction:', transaction);

    if (transaction.status !== 'success') {
      const error = new Error(errorMessage);
      Sentry.captureException(error, {
        tags: {
          type: 'transaction_failed',
          chainId: chain.id,
          status: transaction.status,
        },
        extra: {
          transactionHash,
          userOpHash,
          transactions,
          accountAddress: smartAccountClient.account?.address,
          nonce,
        },
      });
      throw error;
    }

    return { transaction, userOpHash, transactionHash: transaction.transactionHash };
  } catch (error: any) {
    if (isWebAuthnUserCancelledError(error)) {
      Sentry.addBreadcrumb({
        message: 'User cancelled transaction',
        category: 'transaction',
        level: 'info',
        data: {
          chainId: chain.id,
          transactionCount: transactions.length,
        },
      });
      return USER_CANCELLED_TRANSACTION;
    }

    // Enhanced error handling for UserOperation failures
    if (isUserOperationError(error)) {
      console.error('UserOperation simulation failed:', {
        error: error.message,
        cause: error.cause,
        details: error.details,
        request: error.request,
      });

      Sentry.captureException(error, {
        tags: {
          type: 'user_operation_simulation_error',
          chainId: chain.id,
        },
        extra: {
          errorMessage,
          userOpHash,
          transactions,
          accountAddress: smartAccountClient.account?.address,
          errorDetails: error.details || 'No details available',
          errorCause: error.cause?.toString(),
        },
      });
    } else {
      Sentry.captureException(error, {
        tags: {
          type: 'transaction_execution_error',
          chainId: chain.id,
        },
        extra: {
          errorMessage,
          userOpHash,
          transactions,
          accountAddress: smartAccountClient.account?.address,
        },
      });
    }

    throw error;
  }
};
