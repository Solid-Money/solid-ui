import { Query, QueryClient } from '@tanstack/react-query';

const USER_QUERY_ROOTS = new Set([
  'tokenBalances',
  'vault',
  'user-transactions',
  'cardStatus',
  'cardDetails',
  'cardBalance',
  'cardSpendRegistration',
  'cardSpendModeAccess',
  'portfolioCustody',
  'tierMembership',
]);
const SHARED_QUERY_ROOTS = new Set([
  'vaultExchangeRate',
  'ethPriceUsd',
  'fusePriceUsd',
  'cardTransactions',
  'card-transactions-poller',
  'layerZeroStatus',
  'tx-receipt-poll',
]);

/** Shared by manual refresh and balance events; leave other accounts' caches alone. */
export async function refreshAccountQueries(
  queryClient: QueryClient,
  userId: string,
  safeAddress: string,
  throwOnError = false,
) {
  const address = safeAddress.toLowerCase();
  const predicate = (query: Query) => {
    const [root, ...parts] = query.queryKey;
    if (SHARED_QUERY_ROOTS.has(String(root))) return true;
    if (USER_QUERY_ROOTS.has(String(root))) {
      return parts.some(
        part => typeof part === 'string' && (part === userId || part.toLowerCase() === address),
      );
    }
    // Savings rates and balances can be backed by wagmi's inner contract cache.
    if (root === 'readContract') {
      const options = parts[0] as { functionName?: string; args?: unknown[] } | undefined;
      return (
        options?.functionName === 'getRate' ||
        !!options?.args?.some(arg => typeof arg === 'string' && arg.toLowerCase() === address)
      );
    }
    return false;
  };

  const queries = queryClient.getQueryCache().findAll({ predicate });
  // Mark inner contract reads stale before outer savings queries read them.
  await queryClient.invalidateQueries({ predicate, refetchType: 'none' });
  const results = await Promise.allSettled(
    queries.map(query =>
      queryClient.refetchQueries(
        { queryKey: query.queryKey, exact: true, type: 'active' },
        { cancelRefetch: false, throwOnError },
      ),
    ),
  );
  const failure = results.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}
