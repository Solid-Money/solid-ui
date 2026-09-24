import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { VAULTS } from '@/constants/vaults';
import {
  DEFAULT_HISTORICAL_APY_DAYS,
  historicalApyQueryOptions,
  vaultBreakdownQueryOptions,
} from '@/hooks/useAnalytics';

/**
 * Warms the two queries the vault detail screen cannot inherit from Earn.
 *
 * Balances and APYs are already prefetched app-wide in `(protected)/_layout`,
 * but the APY history and strategy breakdown are keyed per vault, so opening
 * USD leaves ETH and FUSE just as cold — which is why every tile felt slow the
 * first time it was tapped rather than only the first tile.
 *
 * Deferred until after interactions so these six requests queue behind Earn's
 * own balance reads rather than competing with them for the connection.
 */
export const useVaultDetailPrefetch = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      for (const vault of VAULTS) {
        queryClient.prefetchQuery(
          historicalApyQueryOptions(DEFAULT_HISTORICAL_APY_DAYS, vault.type),
        );
        queryClient.prefetchQuery(vaultBreakdownQueryOptions(vault.name.toLowerCase()));
      }
    });

    return () => task.cancel();
  }, [queryClient]);
};
