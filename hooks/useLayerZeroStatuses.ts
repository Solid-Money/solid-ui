import { useQueries } from '@tanstack/react-query';

import { LayerZeroTransactionStatus } from '@/lib/types';
import { getLayerZeroTransaction } from '@/lib/utils/layerzero';

export const useLayerZeroStatuses = (hashes: string[]) => {
  return useQueries({
    queries: hashes.map(hash => ({
      queryKey: ['layerZeroStatus', hash],
      queryFn: () => getLayerZeroTransaction(hash),
      refetchInterval: (data: any) => {
        if (!data) return 10000;
        const isDelivered = data.data?.some(
          (tx: any) => tx.status?.name === LayerZeroTransactionStatus.DELIVERED,
        );
        return isDelivered ? false : 10000;
      },
      // Keep data for a while
      staleTime: 30000,
    })),
  });
};
