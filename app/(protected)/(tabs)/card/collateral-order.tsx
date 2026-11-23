import { useCallback, useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import { type Href, useRouter } from 'expo-router';

import CollateralOrderList from '@/components/Card/CollateralOrder/CollateralOrderList';
import CollateralOrderPreview from '@/components/Card/CollateralOrder/CollateralOrderPreview';
import { buildCollateralOrderRows } from '@/components/Card/CollateralOrder/collateralOrderRows';
import OrderEditorLayout from '@/components/Card/OrderList/OrderEditorLayout';
import OrderListPlaceholder from '@/components/Card/OrderList/OrderListPlaceholder';
import { path } from '@/constants/path';
import { useCardCreditPositions } from '@/hooks/useCardCreditPositions';
import { type CollateralOrderPreviewShop, useCollateralOrder } from '@/hooks/useCollateralOrder';
import { showErrorToast } from '@/lib/errors';
import {
  type CollateralAssetKey,
  sameCollateralOrder,
  visibleCollateralOrder,
  withVisibleCollateralOrder,
} from '@/lib/utils/collateralOrder';

/**
 * Collateral order. Wirex cards, Credit mode.
 *
 * The cardholder ranks the collateral their card locks when it borrows, top first. A purchase
 * locks from the next one when one runs out. The shop's own yield share still comes first — EUR
 * Yield at a euro shop, USD Yield at a dollar shop — so the order decides everything after that,
 * and all of it in any other currency. Reorder only: nothing can be left out.
 *
 * Nothing is saved until Save, and the preview simulates the order on screen, saved or not. No
 * transaction: it governs the next purchase's new locks, and what is already locked stays locked.
 */
export default function CollateralOrderScreen() {
  const router = useRouter();
  const saved = useCollateralOrder();
  const { data: positions, isLoading: isLoadingPositions } = useCardCreditPositions({
    enabled: true,
  });
  const [draft, setDraft] = useState<CollateralAssetKey[] | undefined>();
  const [shop, setShop] = useState<CollateralOrderPreviewShop>('USD');

  const current = draft ?? saved.order;

  // Every collateral this card can lock, held or not; the rest keep their place in the order.
  const rows = useMemo(() => buildCollateralOrderRows(positions), [positions]);
  const visible = useMemo(() => new Set<CollateralAssetKey>(rows.keys()), [rows]);
  const slots = useMemo(() => visibleCollateralOrder(current, visible), [current, visible]);

  const handleChange = useCallback(
    (next: string[]) => setDraft(withVisibleCollateralOrder(next, current, visible)),
    [current, visible],
  );

  // Nothing can be edited until the saved order has answered: a drag or a Reset before then would
  // start from the default order, and Save would write it over the saved one. That covers a read
  // still waiting on the card provider, paused offline, or failed, not only one in flight.
  const isReady = saved.hasLoaded && saved.canEdit;

  // Opened without the cohort (a stale link, or the tag was removed): back to the card.
  useEffect(() => {
    if (saved.hasLoaded && !saved.canEdit) router.replace(path.CARD_DETAILS as Href);
  }, [router, saved.canEdit, saved.hasLoaded]);
  const isChanged = !sameCollateralOrder(current, saved.order);
  const canSave = isReady && isChanged && !saved.isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await saved.save(current);
      Toast.show({ type: 'success', text1: 'Collateral order saved', props: { badgeText: '' } });
      if (router.canGoBack()) router.back();
      else router.replace(path.CARD_DETAILS as Href);
    } catch (error) {
      void showErrorToast(error, { action: 'card_settings' });
    }
  };

  const list =
    isReady && slots.length > 0 ? (
      <CollateralOrderList slots={slots} rows={rows} onChange={handleChange} />
    ) : saved.loadFailed ? (
      <OrderListPlaceholder
        kind="failed"
        message="We couldn’t load your collateral order."
        onRetry={() => void saved.retry()}
      />
    ) : isLoadingPositions || !isReady ? (
      <OrderListPlaceholder kind="loading" />
    ) : (
      <OrderListPlaceholder kind="empty" message="Your card has no collateral to order yet." />
    );

  return (
    <OrderEditorLayout
      title="Collateral order"
      intro="Your card locks collateral from the top. If one runs out, the rest is locked from the next one."
      note="Euro shops lock your EUR Yield first and dollar shops your USD Yield. For any other currency, your card follows this order. Collateral that’s already locked stays locked."
      list={list}
      preview={<CollateralOrderPreview draft={current} shop={shop} onShopChange={setShop} />}
      onReset={() => setDraft([...saved.defaultOrder])}
      canReset={isReady}
      onSave={handleSave}
      canSave={canSave}
      isSaving={saved.isSaving}
      saveAccessibilityLabel="Save collateral order"
      fallbackHref={path.CARD_DETAILS as Href}
    />
  );
}
