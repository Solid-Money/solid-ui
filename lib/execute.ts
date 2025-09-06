import { publicClient } from '@/lib/wagmi';
import * as Sentry from '@sentry/react-native';
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

const isUserOperationError = (error: any): boolean => {
  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('useroperation reverted') ||
    message.includes('simulate validation result') ||
    message.includes('paymaster') ||
    message.includes('execution reverted')
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

    const transactionHash = await smartAccountClient.sendTransaction({
      calls: transactions,
      nonce,
    });

    const transaction = await publicClient(chain.id).waitForTransactionReceipt({
      hash: transactionHash,
    });

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
          transactions,
          accountAddress: smartAccountClient.account?.address,
          nonce,
        },
      });
      throw error;
    }

    return transaction;
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
          transactions,
          accountAddress: smartAccountClient.account?.address,
        },
      });
    }

    throw error;
  }
};
