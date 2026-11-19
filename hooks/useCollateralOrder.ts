import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCardProvider } from '@/hooks/useCardProvider';
import { CARD_SPENDABLE_QUERY_KEY } from '@/hooks/useCardSpendable';
import { CARD_SPEND_REGISTRATION_QUERY_KEY } from '@/hooks/useCardSpendRegistration';
import useDebounce from '@/hooks/useDebounce';
import { SPEND_ORDER_PREVIEW_PURCHASE, type SpendOrderPreviewShop } from '@/hooks/useSpendOrder';
import useUser from '@/hooks/useUser';
import {
  getCardCollateralOrder,
  getCardCollateralOrderPreview,
  setCardCollateralOrder,
} from '@/lib/api';
import { CardCollateralOrder, CardProvider } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import {
  type CollateralAssetKey,
  DEFAULT_COLLATERAL_ORDER,
  normalizeCollateralOrder,
} from '@/lib/utils/collateralOrder';

export const CARD_COLLATERAL_ORDER_QUERY_KEY = 'cardCollateralOrder';
export const CARD_COLLATERAL_ORDER_PREVIEW_QUERY_KEY = 'cardCollateralOrderPreview';

/**
 * The order a Wirex card locks collateral in when it borrows (`GET /wirex/collateral-order`).
 *
 * The configured order until it answers, for a card that is not Wirex, and against a backend that
 * does not send one — the same thing a cardholder who never opened the screen has.
 */
export const useCollateralOrder = () => {
  const { user } = useUser();
  const { provider } = useCardProvider();
  const queryClient = useQueryClient();
  const queryKey = [CARD_COLLATERAL_ORDER_QUERY_KEY, user?.userId];

  const query = useQuery({
    queryKey,
    queryFn: () => withRefreshToken(() => getCardCollateralOrder()),
    enabled: !!user?.userId && provider === CardProvider.WIREX,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const order = useMemo<CollateralAssetKey[]>(
    () =>
      query.data?.collateralOrder
        ? normalizeCollateralOrder(query.data.collateralOrder)
        : [...DEFAULT_COLLATERAL_ORDER],
    [query.data],
  );

  const mutation = useMutation({
    mutationFn: (next: readonly CollateralAssetKey[]) =>
      withRefreshToken(() => setCardCollateralOrder({ order: [...next] })),
    onSuccess: saved => {
      // Written into the cached read at once, so the Credit panel re-sorts on the press; the
      // refetches then bring the backend's own figures. The quoted credit can move with the order
      // (the lock list is cut to the module's token limit in this order), so the backend's
      // spendable figure and the credit reads are refreshed too.
      queryClient.setQueryData<CardCollateralOrder>(queryKey, saved);
      void queryClient.invalidateQueries({ queryKey: [CARD_COLLATERAL_ORDER_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [CARD_COLLATERAL_ORDER_PREVIEW_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [CARD_SPENDABLE_QUERY_KEY] });
      void queryClient.invalidateQueries({
        queryKey: [CARD_SPEND_REGISTRATION_QUERY_KEY, 'credit-positions'],
      });
    },
  });

  return {
    order,
    customized: query.data?.collateralOrderCustomized ?? false,
    /**
     * Whether to offer "Edit order": the backend's internal-team cohort decides. Fails closed —
     * false until the read answers, and on a backend that does not send it. Saved orders still
     * apply for everyone; this only hides the entry.
     */
    canEdit: query.data?.canEdit === true,
    isLoading: query.isLoading,
    /**
     * The saved order has answered at least once. Until then `order` is the default one — also
     * while the read is paused offline, disabled because the card provider is not known yet, or
     * failed — so an editor must not take it as its starting point. `isLoading` alone does not say
     * this: it is false in all three cases.
     */
    hasLoaded: query.data !== undefined,
    /**
     * The read failed, nothing was ever loaded and no retry is running: the editor offers a retry
     * instead of the list.
     */
    loadFailed: query.isError && query.data === undefined && !query.isFetching,
    retry: query.refetch,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
};

/** The shop a preview is priced for: the same three the Spend order preview offers. */
export type CollateralOrderPreviewShop = SpendOrderPreviewShop;

/** $150 at a dollar shop, €50 at a euro shop, $100 in any other currency (sent as pounds). */
export const COLLATERAL_ORDER_PREVIEW_PURCHASE = SPEND_ORDER_PREVIEW_PURCHASE;

/**
 * What a purchase at `shop` would newly lock under `draft`, simulated by the backend from the
 * contract's lock math — so the preview never shows a lock the card would not make. Debounced, so
 * dragging a row does not send a request per swap, and the last answer stays on screen while the
 * next one loads.
 */
export const useCollateralOrderPreview = (
  draft: readonly CollateralAssetKey[],
  shop: CollateralOrderPreviewShop,
) => {
  const { user } = useUser();
  const { provider } = useCardProvider();
  const debounced = useDebounce(draft, 300);
  const purchase = COLLATERAL_ORDER_PREVIEW_PURCHASE[shop];

  return useQuery({
    queryKey: [CARD_COLLATERAL_ORDER_PREVIEW_QUERY_KEY, user?.userId, shop, debounced.join(',')],
    queryFn: () =>
      withRefreshToken(() => getCardCollateralOrderPreview({ ...purchase, order: [...debounced] })),
    enabled: !!user?.userId && provider === CardProvider.WIREX,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
  });
};

export default useCollateralOrder;
