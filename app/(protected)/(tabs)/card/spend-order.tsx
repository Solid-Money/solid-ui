import { useCallback, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import { type Href, useRouter } from 'expo-router';

import { useAllSpendableAssetRows } from '@/components/Card/NewCardDetails/SpendMode/useSpendableAssetRows';
import OrderEditorLayout from '@/components/Card/OrderList/OrderEditorLayout';
import SpendOrderList from '@/components/Card/SpendOrder/SpendOrderList';
import SpendOrderPreview from '@/components/Card/SpendOrder/SpendOrderPreview';
import {
  buildSpendOrderRows,
  fromSlots,
  spendsNothing as spendsNothingIn,
  toSlots,
} from '@/components/Card/SpendOrder/spendOrderRows';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useAllCardSpendableAssets } from '@/hooks/useCardSpendableBalance';
import { type SpendOrderPreviewShop, useSpendOrder } from '@/hooks/useSpendOrder';
import { showErrorToast } from '@/lib/errors';
import {
  DEFAULT_SPEND_ORDER_PREFERENCE,
  sameSpendOrder,
  type SpendAssetKey,
  type SpendOrderPreference,
} from '@/lib/utils/spendOrder';

/**
 * Spend order (Figma 30971:15157, 30972:15178). Wirex cards, Cash mode.
 *
 * The cardholder ranks the balances their card pays from, top first, and drags any they want kept
 * out below "Your card won’t use". A purchase moves to the next balance when one runs out, in the
 * same purchase. The shop's own currency still comes first — euros at a euro shop, dollars at a
 * dollar shop — so the order decides everything after that, and all of it in any other currency.
 *
 * Nothing is saved until Save, and the preview prices the order on screen, saved or not. No
 * transaction: it takes effect on the next payment.
 */
export default function SpendOrderScreen() {
  const router = useRouter();
  const saved = useSpendOrder();
  const assets = useAllCardSpendableAssets();
  const { rows: held } = useAllSpendableAssetRows();
  const [draft, setDraft] = useState<SpendOrderPreference | undefined>();
  const [shop, setShop] = useState<SpendOrderPreviewShop>('USD');

  const savedPreference = useMemo<SpendOrderPreference>(
    () => ({ order: saved.order, excluded: saved.excluded }),
    [saved.order, saved.excluded],
  );
  const current = draft ?? savedPreference;

  // Only what this card can spend is listed (never the card bonus, which is not an asset); the
  // rest keep their place in the saved order.
  const rows = useMemo(() => buildSpendOrderRows(assets, held), [assets, held]);
  const visible = useMemo(() => new Set<SpendAssetKey>(rows.keys()), [rows]);
  const slots = useMemo(() => toSlots(current, visible), [current, visible]);

  const handleChange = useCallback(
    (next: string[]) => setDraft(fromSlots(next, current, visible)),
    [current, visible],
  );

  const isChanged = !sameSpendOrder(current, savedPreference);
  // A card with nothing left to spend would decline every purchase.
  const spendsNothing = spendsNothingIn(slots);
  const canSave = isChanged && !spendsNothing && !saved.isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await saved.save(current);
      Toast.show({ type: 'success', text1: 'Spend order saved', props: { badgeText: '' } });
      if (router.canGoBack()) router.back();
      else router.replace(path.CARD_DETAILS as Href);
    } catch (error) {
      void showErrorToast(error, { action: 'card_settings' });
    }
  };

  return (
    <OrderEditorLayout
      title="Spend order"
      intro="Your card pays from the top. If a balance runs out, the rest of the purchase comes from the next one."
      note="Euro shops always use your euros first and dollar shops your dollars, so you don’t pay an FX fee. For any other currency, your card follows this order."
      list={<SpendOrderList slots={slots} rows={rows} onChange={handleChange} />}
      listFooter={
        spendsNothing ? (
          <Text className="mt-3 px-[6px] text-[14px] font-normal leading-[18px] text-[#D96167]">
            Keep at least one balance for your card to spend.
          </Text>
        ) : null
      }
      preview={<SpendOrderPreview draft={current} shop={shop} onShopChange={setShop} />}
      onReset={() => setDraft({ ...DEFAULT_SPEND_ORDER_PREFERENCE })}
      onSave={handleSave}
      canSave={canSave}
      isSaving={saved.isSaving}
      saveAccessibilityLabel="Save spend order"
      fallbackHref={path.CARD_DETAILS as Href}
    />
  );
}
