import { useQuery } from '@tanstack/react-query';
import { secondsToMilliseconds } from 'date-fns';

import { getInfoClientStocks } from '@/graphql/clients';
import {
  GET_STOCK_VAULT_TRANSACTIONS_QUERY,
  type StockVaultTransactions,
} from '@/graphql/queries/stockVaults';

/**
 * Every stock vault deposit and withdraw request of `safeAddress`, from the stocks
 * subgraph. Undefined when this build has no stocks subgraph.
 */
export const fetchStockVaultTransactions = async (
  safeAddress: string,
): Promise<StockVaultTransactions | undefined> => {
  const client = getInfoClientStocks();
  if (!client) return undefined;
  const { data } = await client.query({
    query: GET_STOCK_VAULT_TRANSACTIONS_QUERY,
    variables: { address: safeAddress.toLowerCase() },
    // React Query owns the freshness window, as for the other vaults' subgraphs.
    fetchPolicy: 'network-only',
  });
  return data;
};

/**
 * {@link fetchStockVaultTransactions} as a query: under `user-transactions`, so it is
 * refreshed and kept with the other vaults' subgraph reads. Disabled without a
 * stocks subgraph, and without an address to ask about.
 */
export const useStockVaultTransactions = (safeAddress: string | undefined) =>
  useQuery({
    queryKey: ['user-transactions', safeAddress?.toLowerCase(), 'stocks'],
    queryFn: () => fetchStockVaultTransactions(safeAddress!),
    enabled: !!safeAddress && !!getInfoClientStocks(),
    staleTime: secondsToMilliseconds(30),
    gcTime: secondsToMilliseconds(300),
    refetchInterval: secondsToMilliseconds(30),
  });
