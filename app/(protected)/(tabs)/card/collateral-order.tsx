import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { type Href, useRouter } from 'expo-router';

import CollateralOrderList from '@/components/Card/CollateralOrder/CollateralOrderList';
import CollateralOrderPreview from '@/components/Card/CollateralOrder/CollateralOrderPreview';
import { buildCollateralOrderRows } from '@/components/Card/CollateralOrder/collateralOrderRows';
import OrderEditorLayout from '@/components/Card/OrderList/OrderEditorLayout';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardCreditPositions } from '@/hooks/useCardCreditPositions';
import { type CollateralOrderPreviewShop, useCollateralOrder } from '@/hooks/useCollateralOrder';
import { showErrorToast } from '@/lib/errors';
import {
  type CollateralAssetKey,
  DEFAULT_COLLATERAL_ORDER,
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

  const isChanged = !sameCollateralOrder(current, saved.order);
  const canSave = isChanged && !saved.isSaving;

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
    slots.length > 0 ? (
      <CollateralOrderList slots={slots} rows={rows} onChange={handleChange} />
    ) : isLoadingPositions || saved.isLoading ? (
      <View style={styles.placeholder}>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </View>
    ) : (
      <View style={styles.placeholder}>
        <Text className="text-[14px] font-normal leading-[18px] text-white/50">
          Your card has no collateral to order yet.
        </Text>
      </View>
    );

  return (
    <OrderEditorLayout
      title="Collateral order"
      intro="Your card locks collateral from the top. If one runs out, the rest is locked from the next one."
      note="Euro shops lock your EUR Yield first and dollar shops your USD Yield. For any other currency, your card follows this order. Collateral that’s already locked stays locked."
      list={list}
      preview={<CollateralOrderPreview draft={current} shop={shop} onShopChange={setShop} />}
      onReset={() => setDraft([...DEFAULT_COLLATERAL_ORDER])}
      onSave={handleSave}
      canSave={canSave}
      isSaving={saved.isSaving}
      saveAccessibilityLabel="Save collateral order"
      fallbackHref={path.CARD_DETAILS as Href}
    />
  );
}

const styles = StyleSheet.create({
  // The list panel's look while there are no rows to drag.
  placeholder: { backgroundColor: '#2B2B2B', borderRadius: 20, gap: 12, padding: 20 },
});
