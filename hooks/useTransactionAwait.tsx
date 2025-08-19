import getTokenIcon from '@/lib/getTokenIcon';
import { eclipseAddress } from '@/lib/utils';
import { getChain } from '@/lib/wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { Address } from 'viem';
import { useWaitForTransactionReceipt } from 'wagmi';
import { getBalanceQueryKey } from 'wagmi/query';
import useUser from './useUser';

// export const ViewTxOnExplorer = ({ hash }: { hash: Address | undefined }) =>
//     hash ? (
//         <ToastAction altText="View on explorer" asChild>
//             <Link
//                 to={`https://explorer.fuse.io/tx/${hash}`}
//                 target={'_blank'}
//                 className="border-none gap-2 hover:bg-transparent hover:text-blue-400"
//             >
//                 View on explorer
//                 <ExternalLinkIcon size={16} />
//             </Link>
//         </ToastAction>
//     ) : (
//         <></>
//     );

export interface TransactionSuccessInfo {
  title: string;
  description: string;
  inputAmount?: string;
  outputAmount?: string;
  inputSymbol?: string;
  outputSymbol?: string;
  tokenSymbol?: string;
  chainId?: number;
  onSuccess?: () => void;
}

/**
 * Custom hook to handle transaction status and provide user feedback.
 *
 * @param {Address | undefined} hash - The transaction hash.
 * @param {TransactionSuccessInfo} [successInfo] - Information for success notification.
 *
 * @returns {Object} - An object containing transaction status and data.
 * @returns {any} data - The transaction data.
 * @returns {boolean} isError - Indicates if there was an error with the transaction.
 * @returns {boolean} isLoading - Indicates if the transaction is still loading.
 * @returns {boolean} isSuccess - Indicates if the transaction was successful.
 */
export function useTransactionAwait(
  hash: `0x${string}` | undefined,
  successInfo?: TransactionSuccessInfo,
) {
  const { user } = useUser();
  const account = user?.safeAddress;
  const queryClient = useQueryClient();
  const processedHashes = useRef(new Set<string>());

  // const navigate = useNavigate();

  // const { address: account } = useAccount();

  // const {
  //     actions: { addPendingTransaction, updatePendingTransaction },
  // } = usePendingTransactionsStore();

  const { data, isError, isLoading, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isLoading && hash && account) {
      // toast({
      //     title: transactionInfo.title,
      //     description: transactionInfo.description || 'Transaction was sent',
      //     action: <ViewTxOnExplorer hash={hash} />,
      // });
      // addPendingTransaction(account, hash);
      // updatePendingTransaction(account, hash, {
      //     data: transactionInfo,
      //     loading: true,
      //     success: null,
      //     error: null,
      // });
    }
  }, [isLoading, hash, account]);

  useEffect(() => {
    if (isError && hash) {
      // toast({
      //     title: transactionInfo.title,
      //     description: transactionInfo.description || 'Transaction failed',
      //     action: <ViewTxOnExplorer hash={hash} />,
      // });
    }
  }, [isError]);

  useEffect(() => {
    if (isSuccess && hash && !processedHashes.current.has(hash)) {
      // Mark this hash as processed to prevent duplicate calls
      processedHashes.current.add(hash);

      // Invalidate all balance queries for this account to refresh displayed balances
      if (account) {
        queryClient.invalidateQueries({
          queryKey: getBalanceQueryKey({ address: account as Address }),
        });
      }

      // Call success callback and show toast if successInfo is provided
      if (successInfo) {
        // Call success callback if provided (only once per hash)
        if (successInfo.onSuccess) {
          successInfo.onSuccess();
        }

        // Show success Toast notification
        Toast.show({
          type: 'success',
          text1: successInfo.title,
          text2: successInfo.description,
          props: {
            link: `${getChain(successInfo.chainId || 122)?.blockExplorers?.default.url}/tx/${hash}`,
            linkText: eclipseAddress(hash),
            image: getTokenIcon({
              tokenSymbol: successInfo.tokenSymbol || successInfo.inputSymbol,
              size: 24,
            }),
          },
        });
      }
    }
  }, [isSuccess, hash, successInfo, account, queryClient]);

  return {
    data,
    isError,
    isLoading,
    isSuccess,
  };
}
