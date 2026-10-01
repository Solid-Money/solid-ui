import { constructActivity } from '@/lib/activityEvents';
import { fetchActivityEvent, fetchActivityEvents } from '@/lib/api';
import { TransactionStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useActivityStore } from '@/store/useActivityStore';

/** Reconcile missed live events, including pending rows older than the first page. */
export async function refreshWalletActivity(
  userId: string,
  safeAddress: string,
  isSelected = () => true,
) {
  const page = await withRefreshToken(() => fetchActivityEvents(1));
  if (!page) throw new Error('Activity refresh returned no data');
  if (!isSelected()) return page;
  const store = useActivityStore.getState();
  const events = page.docs.filter(Boolean).map(tx => constructActivity(tx, safeAddress));
  store.bulkUpsertEvent(userId, events);

  const latestIds = new Set(events.map(event => event.clientTxId));
  const outstanding = (store.events[userId] ?? []).filter(
    event =>
      event &&
      !event.deleted &&
      !latestIds.has(event.clientTxId) &&
      [
        TransactionStatus.PENDING,
        TransactionStatus.DETECTED,
        TransactionStatus.PROCESSING,
      ].includes(event.status),
  );
  const failures: unknown[] = [];
  // Bound concurrency for accounts with many historical pending transactions.
  for (let offset = 0; offset < outstanding.length; offset += 4) {
    const results = await Promise.allSettled(
      outstanding.slice(offset, offset + 4).map(async event => {
        if (!isSelected()) return;
        try {
          const fresh = await withRefreshToken(() => fetchActivityEvent(event.clientTxId));
          if (fresh && isSelected())
            store.upsertEvent(userId, constructActivity(fresh, safeAddress));
        } catch (error) {
          // A local optimistic row may not have reached the server yet.
          if ((error as { status?: number })?.status !== 404) throw error;
        }
      }),
    );
    for (const result of results) {
      if (result.status === 'rejected') failures.push(result.reason);
    }
  }
  if (failures.length) throw failures[0];
  return page;
}
