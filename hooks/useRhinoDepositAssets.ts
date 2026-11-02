import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useDepositTokensAccess } from '@/hooks/useDepositTokensAccess';
import { getRhinoDepositAssets } from '@/lib/api';
import {
  getRhinoChainsForDestination,
  isRhinoDepositOffered,
  RhinoRouteFilter,
} from '@/lib/rhinoDeposit';

import type { RhinoDepositAssetsResponse } from '@/lib/types';

export const RHINO_DEPOSIT_ASSETS_QUERY_KEY = 'rhino-deposit-assets';

/**
 * The chains, tokens and routes rhino.fi offers, as `/deposit/rhino/assets`
 * lists them. Config, the same for everyone, so cached for five minutes.
 *
 * Never a requirement: while it loads, fails, or says `enabled: false`, the
 * screens list the chains our own pipeline watches and nothing more. One retry,
 * as for `/deposit/assets`, and no toast if a refresh fails.
 */
export const useRhinoDepositAssets = (enabled = true) =>
  useQuery({
    queryKey: [RHINO_DEPOSIT_ASSETS_QUERY_KEY],
    queryFn: getRhinoDepositAssets,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    meta: { errorToast: false },
  });

/**
 * rhino.fi's assets when this user is offered them, undefined otherwise.
 *
 * Gated on the new-deposit-tokens rollout (`useDepositTokensAccess`, which fails
 * closed) and on the backend having rhino.fi configured. The list is not even
 * fetched for someone outside the rollout.
 */
export const useOfferedRhinoDepositAssets = (): RhinoDepositAssetsResponse | undefined => {
  const { isEnabled: hasAccess } = useDepositTokensAccess();
  const { data } = useRhinoDepositAssets(hasAccess);
  return isRhinoDepositOffered(hasAccess, data) ? data : undefined;
};

/**
 * The rhino.fi chains a deposit screen lists under its own networks: those with
 * a route to its destination (for the chosen token and vault, when there is
 * one). Empty whenever rhino.fi is not offered.
 */
export const useRhinoDepositChains = ({ destinationType, symbol, vault }: RhinoRouteFilter) => {
  const assets = useOfferedRhinoDepositAssets();
  const chains = useMemo(
    () => getRhinoChainsForDestination(assets, { destinationType, symbol, vault }),
    [assets, destinationType, symbol, vault],
  );
  return { assets, chains };
};
