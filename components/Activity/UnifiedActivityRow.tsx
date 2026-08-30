import { useCallback } from 'react';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import CardActivityRow from '@/components/Activity/CardActivityRow';
import Transaction from '@/components/Transaction';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { ActivityTab, CardProvider, Cashback, TransactionType } from '@/lib/types';
import { UnifiedActivityItem } from '@/lib/utils/unifiedActivity';
import { useDepositStore } from '@/store/useDepositStore';

/**
 * Opening a row from the merged feed.
 *
 * A bank transfer opens its own preview sheet — it is the one row whose detail
 * lives in a modal rather than on the activity detail route. Everything else
 * goes to `/activity/[clientTxId]`, with `tab` remembered so the back gesture
 * returns to the filter the user was on.
 */
export function useUnifiedActivityPress(tab: ActivityTab) {
  const { setModal, setBankTransferData } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setBankTransferData: state.setBankTransferData,
    })),
  );

  return useCallback(
    (item: UnifiedActivityItem) => {
      if (item.kind === 'card') {
        router.push(`/activity/card-${item.transaction.id}?tab=${tab}`);
        return;
      }

      const { activity } = item;
      if (activity.type === TransactionType.BANK_TRANSFER) {
        setBankTransferData({
          instructions: activity.metadata?.sourceDepositInstructions,
          fromActivity: true,
        });
        setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PREVIEW);
        return;
      }

      router.push(`/activity/${activity.clientTxId}?tab=${tab}`);
    },
    [tab, setModal, setBankTransferData],
  );
}

type UnifiedActivityRowProps = {
  item: UnifiedActivityItem;
  cashbacks?: Cashback[];
  provider?: CardProvider | null;
  isFirst?: boolean;
  isLast?: boolean;
  showTimestamp?: boolean;
  onPress: (item: UnifiedActivityItem) => void;
};

/**
 * One row of the merged feed, wallet or card. Keeping the choice in one place is
 * what lets the wallet's "Recent activity" and the Activity screen show the same
 * row for the same transaction.
 */
export default function UnifiedActivityRow({
  item,
  cashbacks,
  provider,
  isFirst = false,
  isLast = false,
  showTimestamp = false,
  onPress,
}: UnifiedActivityRowProps) {
  if (item.kind === 'card') {
    return (
      <CardActivityRow
        transaction={item.transaction}
        cashbacks={cashbacks}
        provider={provider}
        isFirst={isFirst}
        isLast={isLast}
        showTimestamp={showTimestamp}
        onPress={() => onPress(item)}
      />
    );
  }

  return (
    <Transaction
      {...item.activity}
      title={item.activity.title}
      showTimestamp={showTimestamp}
      isFirst={isFirst}
      isLast={isLast}
      onPress={() => onPress(item)}
    />
  );
}
