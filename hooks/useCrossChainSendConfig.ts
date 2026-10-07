import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchCrossChainSendConfig } from '@/lib/api/cross-chain-send';
import {
  CrossChainSendConfig,
  CrossChainSendExchangeConfig,
  CrossChainSendNetworkConfig,
  CrossChainSendRouteStatus,
  CrossChainSendToken,
} from '@/lib/types/cross-chain-send';
import { withRefreshToken } from '@/lib/utils';

export const CROSS_CHAIN_SEND_CONFIG_QUERY_KEY = ['cross-chain-send', 'config'] as const;

export const getNetwork = (config: CrossChainSendConfig | undefined, chainId: number | null) =>
  chainId === null ? undefined : config?.networks.find(network => network.chainId === chainId);

export const getExchange = (config: CrossChainSendConfig | undefined, id: string | null) =>
  id === null ? undefined : config?.exchanges.find(exchange => exchange.id === id);

export const getRoute = (
  config: CrossChainSendConfig | undefined,
  token: CrossChainSendToken | null,
  chainId: number | null,
) =>
  token === null || chainId === null
    ? undefined
    : config?.routes.find(route => route.token === token && route.chainId === chainId);

export const isNetworkAcceptedBy = (
  exchange: CrossChainSendExchangeConfig | undefined,
  token: CrossChainSendToken | null,
  chainId: number | null,
) =>
  !!exchange &&
  token !== null &&
  chainId !== null &&
  (exchange.networks[token] ?? []).some(network => network.chainId === chainId);

type Options = {
  /** Skip the request while the flow can't be offered (a non-bridgeable token). */
  enabled?: boolean;
};

/**
 * The cross-chain send config: exchanges, networks, limits and the live
 * Stargate credit per route. Shared by every step of the flow, so it lives in
 * react-query rather than being passed down; the credit refresh keeps the
 * "Up to N right now" copy honest without the user leaving the sheet.
 */
export const useCrossChainSendConfig = ({ enabled = true }: Options = {}) => {
  const query = useQuery({
    queryKey: CROSS_CHAIN_SEND_CONFIG_QUERY_KEY,
    queryFn: () => withRefreshToken(() => fetchCrossChainSendConfig()),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled,
  });

  const config = query.data;

  const network = useCallback(
    (chainId: number | null): CrossChainSendNetworkConfig | undefined =>
      getNetwork(config, chainId),
    [config],
  );
  const exchange = useCallback(
    (id: string | null): CrossChainSendExchangeConfig | undefined => getExchange(config, id),
    [config],
  );
  const route = useCallback(
    (
      token: CrossChainSendToken | null,
      chainId: number | null,
    ): CrossChainSendRouteStatus | undefined => getRoute(config, token, chainId),
    [config],
  );
  const accepts = useCallback(
    (exchangeId: string | null, token: CrossChainSendToken | null, chainId: number | null) =>
      isNetworkAcceptedBy(getExchange(config, exchangeId), token, chainId),
    [config],
  );

  return useMemo(
    () => ({
      ...query,
      config,
      getNetwork: network,
      getExchange: exchange,
      getRoute: route,
      isNetworkAcceptedBy: accepts,
    }),
    [query, config, network, exchange, route, accepts],
  );
};

export default useCrossChainSendConfig;
