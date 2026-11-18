import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCardProvider } from '@/hooks/useCardProvider';
import { CARD_SPENDABLE_QUERY_KEY } from '@/hooks/useCardSpendable';
import useDebounce from '@/hooks/useDebounce';
import useUser from '@/hooks/useUser';
import { getCardSpendOrder, getCardSpendOrderPreview, setCardSpendOrder } from '@/lib/api';
import { CardProvider, CardSpendOrder } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { type SpendOrderPreference, spendOrderPreferenceOf } from '@/lib/utils/spendOrder';

export const CARD_SPEND_ORDER_QUERY_KEY = 'cardSpendOrder';
export const CARD_SPEND_ORDER_PREVIEW_QUERY_KEY = 'cardSpendOrderPreview';

/**
 * The order a Wirex card spends balances in, and the ones it never uses (`GET /wirex/spend-order`).
 *
 * Today's order with nothing excluded until it answers, for a card that is not Wirex, and against a
 * backend that does not send one — the same thing a cardholder who never opened the screen has.
 * Excluded assets are left out of every Spendable figure through `useCardSpendableAssets`, so
 * this read is what decides that figure too.
 */
export const useSpendOrder = () => {
  const { user } = useUser();
  const { provider } = useCardProvider();
  const queryClient = useQueryClient();
  const queryKey = [CARD_SPEND_ORDER_QUERY_KEY, user?.userId];

  const query = useQuery({
    queryKey,
    queryFn: () => withRefreshToken(() => getCardSpendOrder()),
    enabled: !!user?.userId && provider === CardProvider.WIREX,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const preference = useMemo<SpendOrderPreference>(
    () => spendOrderPreferenceOf(query.data),
    [query.data],
  );

  const mutation = useMutation({
    mutationFn: (next: SpendOrderPreference) =>
      withRefreshToken(() => setCardSpendOrder({ order: next.order, excluded: next.excluded })),
    onSuccess: saved => {
      // Written into the cached read at once, so the sheet and every Spendable figure follow the
      // press; the refetches then bring the backend's own figures.
      queryClient.setQueryData<CardSpendOrder>(queryKey, saved);
      void queryClient.invalidateQueries({ queryKey: [CARD_SPEND_ORDER_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [CARD_SPENDABLE_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [CARD_SPEND_ORDER_PREVIEW_QUERY_KEY] });
    },
  });

  return {
    ...preference,
    customized: query.data?.spendOrderCustomized ?? false,
    isLoading: query.isLoading,
    /**
     * The saved preference has answered at least once. Until then the fields above are the
     * default order with nothing excluded — also while the read is paused offline, disabled
     * because the card provider is not known yet, or failed — so an editor must not take that as
     * its starting point. `isLoading` alone does not say this: it is false in all three cases.
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

/** The shop a preview is priced for. */
export type SpendOrderPreviewShop = 'USD' | 'EUR' | 'OTHER';

/**
 * The purchase each preview shows. "Other currency" is sent as pounds with a dollar amount: for
 * any currency but USD and EUR the backend reads `amount` as dollars, and pounds is only there to
 * say "neither", so it follows the cardholder's order.
 */
export const SPEND_ORDER_PREVIEW_PURCHASE: Record<
  SpendOrderPreviewShop,
  { amount: number; currency: string }
> = {
  USD: { amount: 150, currency: 'USD' },
  EUR: { amount: 50, currency: 'EUR' },
  OTHER: { amount: 100, currency: 'GBP' },
};

/**
 * How a purchase at `shop` would be paid under `draft`, from the backend's own selection — so the
 * preview never shows a split the sweep would not make. Debounced, so dragging a row does not
 * send a request per frame, and the last answer stays on screen while the next one loads.
 */
export const useSpendOrderPreview = (draft: SpendOrderPreference, shop: SpendOrderPreviewShop) => {
  const { user } = useUser();
  const { provider } = useCardProvider();
  const debounced = useDebounce(draft, 300);
  const purchase = SPEND_ORDER_PREVIEW_PURCHASE[shop];

  return useQuery({
    queryKey: [
      CARD_SPEND_ORDER_PREVIEW_QUERY_KEY,
      user?.userId,
      shop,
      debounced.order.join(','),
      [...debounced.excluded].sort().join(','),
    ],
    queryFn: () =>
      withRefreshToken(() =>
        getCardSpendOrderPreview({
          ...purchase,
          order: debounced.order,
          excluded: debounced.excluded,
        }),
      ),
    enabled: !!user?.userId && provider === CardProvider.WIREX,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
  });
};

export default useSpendOrder;
