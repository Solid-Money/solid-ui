import {
  useReadAlgebraBasePluginIncentive,
  useReadAlgebraPoolGlobalState,
  useReadAlgebraPoolPlugin,
} from '@/generated/wagmi';
import { usePoolsStore } from '@/store/poolsStore';
import { ADDRESS_ZERO } from '@cryptoalgebra/fuse-sdk';
import { useEffect } from 'react';
import { Address } from 'viem';
import { fuse } from 'viem/chains';

export function usePoolPlugins(poolId: Address | undefined) {
  const { pluginsForPools, setPluginsForPool } = usePoolsStore();

  const skipFetch = Boolean(poolId && pluginsForPools[poolId]);

  const { data: globalState, isLoading: globalStateLoading } = useReadAlgebraPoolGlobalState({
    address: skipFetch ? undefined : poolId,
    chainId: fuse.id,
    query: {
      enabled: Boolean(poolId),
    },
  });

  const { data: plugin, isLoading: pluginLoading } = useReadAlgebraPoolPlugin({
    address: skipFetch ? undefined : poolId,
    chainId: fuse.id,
    query: {
      enabled: Boolean(poolId),
    },
  });

  const { data: hasFarmingPlugin, isLoading: farmingLoading } = useReadAlgebraBasePluginIncentive({
    address: skipFetch ? undefined : plugin,
    chainId: fuse.id,
    query: {
      enabled: Boolean(plugin),
    },
  });

  const isLoading = globalStateLoading || pluginLoading || farmingLoading;

  const hasDynamicFee = globalState && Number(globalState[3]) >> 7 === 1;

  useEffect(() => {
    if (!poolId || isLoading || pluginsForPools[poolId]) return;

    setPluginsForPool(poolId, {
      dynamicFeePlugin: Boolean(hasDynamicFee),
      farmingPlugin: hasFarmingPlugin !== ADDRESS_ZERO,
      limitOrderPlugin: false,
    });
  }, [poolId, isLoading, pluginsForPools]);

  if (poolId && pluginsForPools[poolId]) {
    return {
      ...pluginsForPools[poolId],
      isLoading: false,
    };
  }

  return {
    dynamicFeePlugin: Boolean(hasDynamicFee),
    farmingPlugin: hasFarmingPlugin !== ADDRESS_ZERO,
    limitOrderPlugin: false,
    isLoading,
  };
}
