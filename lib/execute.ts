import * as Sentry from '@sentry/react-native';
import { createSmartAccountClient, SmartAccountClient } from 'permissionless';
import { getAccountNonce } from 'permissionless/actions';
import { Chain, http } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';

import { USER } from '@/lib/config';
import { isSponsorshipLimitError } from '@/lib/errors/classify';
import { UserCopyError } from '@/lib/errors/UserCopyError';
import { pimlicoClient } from '@/lib/pimlico';
import { formatNativeAmount, userOperationPrefund } from '@/lib/utils/userOperation';
import { publicClient } from '@/lib/wagmi';
import { askToPayNetworkFee } from '@/store/useNetworkFeeStore';

export const USER_CANCELLED_TRANSACTION = Symbol('USER_CANCELLED_TRANSACTION');

/** The bundler refusing an unsponsored operation the account can't prefund. */
const PREFUND_SHORTFALL = /\bAA21\b|didn'?t pay prefund|insufficient (?:funds|balance)/i;

/**
 * Sends the operation with our paymaster paying its gas, and when the
 * paymaster's policy won't (it caps what one operation may cost at worst, $2
 * when this was written, and Ethereum gas routinely passes it), offers to let
 * the account pay its own gas instead.
 *
 * The paymaster answers while the operation is being prepared, before the
 * passkey prompt, so nothing was signed or sent when it refuses. The user is
 * then asked, with the most the fee can come to, and only signs if they agree.
 * Resolves to undefined when they decline.
 *
 * {@link executeTransactions} sends through this; use it directly only for an
 * operation that can't go through there (and so isn't tracked as an activity).
 * Without a `nonce` the account's next one is used.
 */
export const sendUserOperationPayingGasIfRefused = async (
  smartAccountClient: SmartAccountClient,
  transactions: any[],
  nonce: bigint | undefined,
  chain: Chain,
): Promise<`0x${string}` | undefined> => {
  try {
    return await smartAccountClient.sendUserOperation({ calls: transactions, nonce });
  } catch (error) {
    if (!isSponsorshipLimitError(error) || !smartAccountClient.account) throw error;
  }

  const account = smartAccountClient.account;
  const { symbol, decimals } = chain.nativeCurrency;
  Sentry.addBreadcrumb({
    message: 'Gas not sponsored: over the policy limit; offering to pay it',
    category: 'transaction',
    level: 'info',
    data: { chainId: chain.id },
  });

  const bundler = pimlicoClient(chain.id);
  const unsponsored = createSmartAccountClient({
    account,
    chain,
    bundlerTransport: http(USER.pimlicoUrl(chain.id)),
    userOperation: {
      estimateFeesPerGas: async () => (await bundler.getUserOperationGasPrice()).fast,
    },
  });

  // Whatever the calls send leaves the account too; a smaller amount only
  // frees gas money when it is the gas token being sent.
  const sent = transactions.reduce(
    (total: bigint, call: { value?: bigint | string | number }) => total + BigInt(call.value ?? 0),
    0n,
  );
  const shortfall = (maxFee?: bigint) =>
    new UserCopyError(
      `Not enough ${symbol} on ${chain.name} to pay the network fee` +
        (maxFee ? ` (up to ${formatNativeAmount(maxFee, decimals)} ${symbol})` : '') +
        (sent > 0n ? `. Lower the amount or add ${symbol}.` : `. Add ${symbol} and try again.`),
    );

  let request;
  try {
    request = await unsponsored.prepareUserOperation({ calls: transactions, nonce });
  } catch (error: any) {
    // Some bundlers simulate with the real fees, so an account short of gas
    // money fails here rather than at the balance check below.
    if (PREFUND_SHORTFALL.test(`${error?.details ?? ''} ${error?.message ?? ''}`)) {
      throw shortfall();
    }
    throw error;
  }

  const maxFee = userOperationPrefund(request);
  const balance = await publicClient(chain.id).getBalance({ address: account.address });
  if (balance < maxFee + sent) throw shortfall(maxFee);

  const accepted = await askToPayNetworkFee({
    chainId: chain.id,
    network: chain.name,
    symbol,
    decimals,
    maxFee,
  });
  if (!accepted) return undefined;

  // Sent as prepared, so the fee is the one the user just agreed to. The
  // prepared operation carries a stub signature, which would be sent as-is:
  // dropped so the passkey signs the real one.
  const { signature: _stub, ...unsigned } = request;
  return unsponsored.sendUserOperation(unsigned as any);
};

export type TransactionResult =
  | {
      transaction: any;
      userOpHash: `0x${string}`;
      transactionHash: `0x${string}`;
    }
  | typeof USER_CANCELLED_TRANSACTION;

/**
 * Whether a signing failure is the user dismissing the passkey prompt rather than
 * something going wrong. WebAuthn reports a cancel and a timeout through the same
 * `NotAllowedError`, and each platform words it differently, so this matches on
 * the message.
 *
 * Exported because anything that raises a passkey prompt needs the distinction —
 * a cancel is a decision, not an error to show.
 */
export const isWebAuthnUserCancelledError = (error: any): boolean => {
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
};

export const executeTransactions = async (
  smartAccountClient: SmartAccountClient,
  transactions: any[],
  errorMessage: string,
  chain: Chain,
  onUserOpHash?: (userOpHash: `0x${string}`) => void,
  onBeforeBroadcast?: () => Promise<void>,
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

    // If TOTP verification is required, do it before sending the transaction
    if (onBeforeBroadcast) {
      await onBeforeBroadcast();
    }

    // Get userOpHash immediately (this triggers passkey signing). Gas is
    // sponsored, or paid by the account if the user agrees once our
    // paymaster's cost cap refuses it.
    userOpHash = await sendUserOperationPayingGasIfRefused(
      smartAccountClient,
      transactions,
      nonce,
      chain,
    );
    if (!userOpHash) {
      Sentry.addBreadcrumb({
        message: 'User declined to pay the network fee',
        category: 'transaction',
        level: 'info',
        data: { chainId: chain.id },
      });
      return USER_CANCELLED_TRANSACTION;
    }

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

    const transactionHash = receipt.receipt.transactionHash;

    // ERC-4337 lets a UserOperation's execution revert *inside* a bundle whose
    // own transaction succeeds, so the bundle receipt below is not enough: the
    // EntryPoint's own success flag is the only thing that says our calls ran.
    // Trusting the bundle alone made a reverted approval look like a completed
    // one, and the caller went on to ask the backend to pull unapproved funds.
    if (!receipt.success) {
      const error = new Error(errorMessage);
      Sentry.captureException(error, {
        tags: {
          type: 'user_operation_reverted',
          chainId: chain.id,
        },
        extra: {
          transactionHash,
          userOpHash,
          reason: receipt.reason,
          transactions,
          accountAddress: smartAccountClient.account?.address,
          nonce,
        },
      });
      throw error;
    }

    // Get the full transaction receipt
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

    // Our own copy for a known state, e.g. no gas money to pay the fee with.
    if (error instanceof UserCopyError) throw error;

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
