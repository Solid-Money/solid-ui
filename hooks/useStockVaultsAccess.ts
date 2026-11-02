import { useQuery } from '@tanstack/react-query';

import { isStockVaultType } from '@/constants/stockVaults';
import useUser from '@/hooks/useUser';
import { getStockVaultsAccess } from '@/lib/api';
import { VaultType } from '@/lib/types';

export const STOCK_VAULTS_ACCESS_QUERY_KEY = 'stockVaultsAccess';

/** How long the gate is trusted before it is asked again. */
const STALE_MS = 5 * 60 * 1000;

/**
 * Whether this user may be offered the stock vaults (soAAPL, soNVDA… on Base).
 *
 * The server decides, on every build: production offers them only to the internal
 * team members tagged for them, and qa opens them to everyone. The build is not
 * asked, so a build with a missing or unexpected environment cannot open them by
 * accident.
 *
 * Fails closed, like `useDepositTokensAccess`: `false` until the request answers,
 * and `false` while the latest request has failed, even if an earlier one said yes —
 * so the vaults never flash into view for someone who is not offered them.
 *
 * This gates OFFERING the vaults — the Earn rows, the savings vault lists, the
 * deposit picker, the deep link. Shares already in a wallet are always shown,
 * valued and can be withdrawn.
 */
export const useStockVaultsAccess = (): { isEnabled: boolean; isLoading: boolean } => {
  const { user } = useUser();

  const { data, isLoading, isError } = useQuery({
    queryKey: [STOCK_VAULTS_ACCESS_QUERY_KEY, user?.userId],
    queryFn: getStockVaultsAccess,
    // Nothing to ask without a signed-in user, and the request would 401.
    enabled: !!user?.userId,
    staleTime: STALE_MS,
    retry: 1,
  });

  return {
    isEnabled: !isError && data?.enabled === true,
    isLoading: !!user?.userId && isLoading,
  };
};

/** Whether a vault of this type may be offered: every vault but the stock vaults, and those only with access. */
export const isVaultOffered = (type: VaultType, isStockVaultsEnabled: boolean): boolean =>
  !isStockVaultType(type) || isStockVaultsEnabled;

export default useStockVaultsAccess;
