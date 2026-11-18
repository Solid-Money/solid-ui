import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getRhinoDepositAssets } from '@/lib/api';
import {
  getRhinoAssetsState,
  getRhinoExtraChains,
  resolveRhinoRow,
  RhinoAssetsState,
  RhinoExtraChainFilter,
  RhinoRowFilter,
  RhinoRowState,
} from '@/lib/rhinoDeposit';

import type { RhinoDepositChain } from '@/lib/types';

export const RHINO_DEPOSIT_ASSETS_QUERY_KEY = 'rhino-deposit-assets';

/**
 * The chains, tokens and routes rhino.fi offers, as `/deposit/rhino/assets`
 * lists them. Config, the same for everyone, so cached for five minutes.
 *
 * A requirement for every network row but Fuse's: rhino.fi is the only provider
 * there, so the screens wait for this list and offer a retry when it cannot be
 * had (see `useOfferedRhinoDepositAssets`). One retry, as for `/deposit/assets`,
 * and no toast: the screens show the failure in place. A backend with rhino.fi
 * off (`enabled: false`, or no such endpoint) is not a failure: every row is
 * then our own pipeline's.
 */
export const useRhinoDepositAssets = () =>
  useQuery({
    queryKey: [RHINO_DEPOSIT_ASSETS_QUERY_KEY],
    queryFn: getRhinoDepositAssets,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    meta: { errorToast: false },
  });

export type OfferedRhinoDepositAssets = RhinoAssetsState & {
  /** Asks again, for the unavailable state's "Try again". */
  retry: () => void;
};

/**
 * rhino.fi's assets as the deposit screens need them: still loading, `ready`
 * with rhino.fi on, `unavailable` (failed), or `disabled` (the backend has
 * rhino.fi off, so our own pipeline serves every row), and a retry.
 *
 * Fetched for everyone and gated on nothing but the backend's `enabled`: not on
 * the new-deposit-tokens rollout, which only decides which wallet tokens are
 * listed. While it loads no row but Fuse's can be decided, so none is offered;
 * that is what stops a row from handing out an address of ours meanwhile.
 */
export const useOfferedRhinoDepositAssets = (): OfferedRhinoDepositAssets => {
  const { data, isFetching, isError, error, refetch } = useRhinoDepositAssets();
  const state = useMemo(
    () => getRhinoAssetsState(data, { isFetching, isError, error }),
    [data, error, isFetching, isError],
  );
  const retry = useCallback(() => void refetch(), [refetch]);
  return useMemo(() => ({ ...state, retry }), [state, retry]);
};

/**
 * A screen's own network rows, each with how it is served (see
 * `resolveRhinoRow`), and the assets' retry for the list's unavailable state.
 * The list shows the `own` and `rhino` rows, marks the `rhino` ones "via
 * rhino.fi", and words the rest with `getRhinoListNotice`.
 */
export const useRhinoNetworkRows = <Row extends { chainId: number }>(
  { destinationType, symbol, vault }: Omit<RhinoRowFilter, 'chainId'>,
  rows: readonly Row[],
): { rows: { row: Row; state: RhinoRowState }[]; retry: () => void } => {
  const rhino = useOfferedRhinoDepositAssets();
  const resolved = useMemo(
    () =>
      rows.map(row => ({
        row,
        state: resolveRhinoRow(rhino, { chainId: row.chainId, destinationType, symbol, vault }),
      })),
    [destinationType, rhino, rows, symbol, vault],
  );
  return { rows: resolved, retry: rhino.retry };
};

/**
 * "More networks" for a screen: the rhino.fi chains the app has no row for,
 * with a route for its token, destination and vault (see
 * `getRhinoExtraChains`). Empty until rhino.fi's routes are in, and when they
 * cannot be had: the screen's own list already says so.
 */
export const useRhinoExtraNetworks = ({
  destinationType,
  symbol,
  vault,
}: RhinoExtraChainFilter): RhinoDepositChain[] => {
  const { assets } = useOfferedRhinoDepositAssets();
  return useMemo(
    () => getRhinoExtraChains(assets, { destinationType, symbol, vault }),
    [assets, destinationType, symbol, vault],
  );
};
