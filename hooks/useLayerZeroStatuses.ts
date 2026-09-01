import { useQueries } from '@tanstack/react-query';

import { LayerZeroTransactionStatus } from '@/lib/types';
import { getLayerZeroTransaction, LayerzeroTransactionResponse } from '@/lib/utils/layerzero';

/** What a caller needs to know about one bridge message, and nothing more. */
export type LayerZeroDelivery = {
  /** False while the first status request is still in flight (or it failed). */
  isLoaded: boolean;
  isDelivered: boolean;
  destinationTxHash?: string;
};

export type LayerZeroDeliveries = Record<string, LayerZeroDelivery>;

const EMPTY_DELIVERIES: LayerZeroDeliveries = {};

/**
 * Delivery status for a set of bridge tx hashes, keyed by hash.
 *
 * Returns a plain object built through `combine` rather than the raw
 * `useQueries` array: without `combine` that array is a fresh instance on every
 * render, so every memo derived from it — in the activity list, the whole
 * status-override / filter / dedup / grouping chain — recomputed on each render
 * of the list rather than only when a status actually changed. `combine` runs
 * the result through `replaceEqualDeep`, so the identity holds until one of the
 * two facts below moves.
 */
export const useLayerZeroStatuses = (hashes: string[]): LayerZeroDeliveries => {
  return useQueries({
    queries: hashes.map(hash => ({
      queryKey: ['layerZeroStatus', hash],
      queryFn: () => getLayerZeroTransaction(hash),
      // v5 hands this callback the Query, not the data — reading `data.data`
      // here always came back undefined, so a delivered message kept polling
      // every 10s for as long as the list stayed mounted.
      refetchInterval: (query: { state: { data?: LayerzeroTransactionResponse } }) => {
        const isDelivered = query.state.data?.data?.some(
          message => message.status?.name === LayerZeroTransactionStatus.DELIVERED,
        );
        return isDelivered ? false : 10000;
      },
      // Keep data for a while
      staleTime: 30000,
    })),
    combine: results => {
      if (!hashes.length) return EMPTY_DELIVERIES;

      const deliveries: LayerZeroDeliveries = {};

      hashes.forEach((hash, index) => {
        const data = results[index]?.data;
        const message = data?.data?.[0];

        deliveries[hash] = {
          isLoaded: !!data,
          isDelivered: message?.status?.name === LayerZeroTransactionStatus.DELIVERED,
          destinationTxHash: message?.destination?.tx?.txHash,
        };
      });

      return deliveries;
    },
  });
};
