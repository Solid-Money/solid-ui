import { produce } from 'immer';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { ActivityEvent, TransactionStatus } from '@/lib/types';
import { isPayoutAwaitingFunds } from '@/lib/utils/payoutAwaitingFunds';

// Maximum events stored per user in the Zustand store (and MMKV).
// Oldest events beyond this cap are evicted to prevent unbounded memory/disk growth.
// Eviction uses a buffer so we don't sort on every single upsert.
const MAX_EVENTS_PER_USER = 500;
const EVICTION_BUFFER = 50;

/**
 * Validates that an activity has all required fields with correct types.
 * Used to filter out corrupted data from storage hydration.
 */
function isValidActivity(activity: unknown): activity is ActivityEvent {
  if (!activity || typeof activity !== 'object') return false;

  const a = activity as Record<string, unknown>;
  return (
    typeof a.clientTxId === 'string' &&
    a.clientTxId.length > 0 &&
    typeof a.type === 'string' &&
    typeof a.status === 'string'
  );
}

/**
 * Status priority for downgrade protection.
 * SUCCESS is the highest priority — once a transaction succeeds, no other
 * status (including FAILED from a stale .catch() or backend race) can
 * overwrite it.  Other terminal states sit at priority 2 and are protected
 * from non-terminal (PENDING / PROCESSING) overwrites.
 */
const STATUS_PRIORITY: Record<string, number> = {
  [TransactionStatus.PENDING]: 0,
  [TransactionStatus.DETECTED]: 1,
  [TransactionStatus.PROCESSING]: 1,
  [TransactionStatus.FAILED]: 2,
  [TransactionStatus.REFUNDED]: 2,
  [TransactionStatus.TRANSFERRED_TO_SAFE]: 2,
  [TransactionStatus.CANCELLED]: 2,
  [TransactionStatus.EXPIRED]: 2,
  [TransactionStatus.SUCCESS]: 3,
};

function isStatusDowngrade(existingStatus: string, incomingStatus: string): boolean {
  return (STATUS_PRIORITY[incomingStatus] ?? 0) < (STATUS_PRIORITY[existingStatus] ?? 0);
}

/**
 * Whether an incoming status is stale and must not overwrite the stored one.
 *
 * A downgrade normally is. The exception is a row the backend has moved back
 * to in-progress because its payout is waiting on our payout wallet
 * (`metadata.payout.state === 'awaiting_funds'`): a Wirex bank deposit Wirex
 * already reported complete, before our EURC transfer to the user went out.
 * That is the backend correcting a premature "complete", not a stale write,
 * and refusing it would keep showing the deposit as done while the user has
 * not been paid.
 */
function isStaleStatus(existing: ActivityEvent, incoming: ActivityEvent): boolean {
  if (!isStatusDowngrade(existing.status, incoming.status)) return false;
  // The awaiting-funds correction, but only from a copy known to be at least
  // as new as the stored one: an older response landing after the payout's
  // "complete" must not put the row back to Pending.
  return !(isPayoutAwaitingFunds(incoming.metadata) && isKnownNotOlder(existing, incoming));
}

/**
 * Whether `incoming` can be trusted to be at least as new as `existing`, for
 * the one exception that lets a status go backwards.
 *
 * Stricter than {@link isOlderCopy}: with a valid `updatedAt` on the stored
 * copy, an incoming one must carry its own, or nothing orders the two and the
 * downgrade is refused. A stored copy without one (a row this device created
 * before the backend's first write) has nothing to order against, and the
 * correction is taken.
 */
function isKnownNotOlder(existing: ActivityEvent, incoming: ActivityEvent): boolean {
  const existingAt = Date.parse(existing.updatedAt ?? '');
  if (!Number.isFinite(existingAt)) return true;
  const incomingAt = Date.parse(incoming.updatedAt ?? '');
  return Number.isFinite(incomingAt) && incomingAt >= existingAt;
}

/** Whether `incoming` was written by the backend after `existing` was. */
function isNewerCopy(existing: ActivityEvent, incoming: ActivityEvent): boolean {
  const incomingAt = Date.parse(incoming.updatedAt ?? '');
  const existingAt = Date.parse(existing.updatedAt ?? '');
  return Number.isFinite(incomingAt) && (!Number.isFinite(existingAt) || incomingAt > existingAt);
}

/**
 * Whether `incoming` was written by the backend before `existing` was.
 *
 * Read from `updatedAt`, which every REST page and realtime event carries. A
 * copy without one is not called older: nothing then says it is.
 */
function isOlderCopy(existing: ActivityEvent, incoming: ActivityEvent): boolean {
  const incomingAt = Date.parse(incoming.updatedAt ?? '');
  const existingAt = Date.parse(existing.updatedAt ?? '');
  return Number.isFinite(incomingAt) && Number.isFinite(existingAt) && incomingAt < existingAt;
}

/**
 * What a merge keeps from the stored copy when the incoming one is older.
 *
 * An older copy can still be merged for a field it changes (a hash, say), but
 * it must not carry back its older `updatedAt` or `metadata`: with those, a
 * replay of the same stale copy would then look current and could put a
 * completed payout back to Pending. A copy without a usable `updatedAt` is not
 * ordered either way, and merges as it always has.
 */
function keptFromNewerCopy(
  existing: ActivityEvent,
  incoming: ActivityEvent,
): Pick<ActivityEvent, 'updatedAt' | 'metadata'> | Record<string, never> {
  return isOlderCopy(existing, incoming)
    ? { updatedAt: existing.updatedAt, metadata: existing.metadata }
    : {};
}

interface ActivityState {
  events: Record<string, ActivityEvent[]>;
  setEvents: (userId: string, events: ActivityEvent[]) => void;
  upsertEvent: (userId: string, event: ActivityEvent) => void;
  bulkUpsertEvent: (userId: string, events: ActivityEvent[]) => void;
  removeEvents: () => void;
  markDeleted: (userId: string, clientTxId: string, deletedAt: Date) => void;
  removeActivity: (userId: string, clientTxId: string) => void;
}

// Helper to check if two events are the same.
// Only match by primary identifiers (clientTxId, userOpHash).
// Hash-based matching was removed because different activities can share
// the same tx hash (e.g., "Deposited USDC" and "Deposit soUSD to Savings"
// both reference the protocol deposit hash). Hash-based dedup is handled
// at render time by deduplicateTransactions() instead.
function isSameEvent(a: ActivityEvent, b: ActivityEvent): boolean {
  // Guard against undefined/null events
  if (!a || !b) return false;

  return (
    a.clientTxId === b.clientTxId ||
    (!!a.userOpHash && a.userOpHash === b.userOpHash) ||
    (!!b.userOpHash && a.clientTxId === b.userOpHash) ||
    (!!a.userOpHash && b.clientTxId === a.userOpHash)
  );
}

/**
 * Strip undefined/null values from an event before merging.
 * Prevents SSE partial updates (where backend sends sanitized fields that may
 * be undefined) from overwriting existing valid data via object spread.
 * e.g., `{ ...existing, ...event }` would set `type: undefined` if event.type
 * is undefined, corrupting the stored event and breaking color/type logic.
 */
function stripNullish(event: ActivityEvent): Partial<ActivityEvent> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  }
  return cleaned as Partial<ActivityEvent>;
}

// Helper to check if event data has actually changed
function hasEventChanged(existing: ActivityEvent, incoming: ActivityEvent): boolean {
  // A status downgrade is not a real change — it's a stale update
  const statusActuallyChanged =
    existing.status !== incoming.status && !isStaleStatus(existing, incoming);
  // The payout flag coming or going is a change on its own, even with the
  // status unchanged — unless the copy carrying it is the older one.
  const payoutFlagChanged =
    isPayoutAwaitingFunds(existing.metadata) !== isPayoutAwaitingFunds(incoming.metadata) &&
    !isOlderCopy(existing, incoming);
  // A newer copy is kept even when nothing else in it differs, so the stored
  // `updatedAt` is always the newest seen: otherwise a copy from between the
  // two would compare against the older one and pass as current.
  const newerCopy = isNewerCopy(existing, incoming);

  return (
    statusActuallyChanged ||
    payoutFlagChanged ||
    newerCopy ||
    existing.hash !== incoming.hash ||
    existing.deleted !== incoming.deleted ||
    existing.failureReason !== incoming.failureReason ||
    existing.amount !== incoming.amount ||
    existing.symbol !== incoming.symbol ||
    existing.title !== incoming.title
  );
}

/**
 * Trim an events array to MAX_EVENTS_PER_USER if it exceeds the threshold.
 * Keeps the most recent events by sorting on timestamp descending.
 * Only triggers when length > MAX + BUFFER to amortize the sort cost.
 *
 * Note: ActivityEvent.timestamp is a string containing Unix seconds.
 */
function trimIfNeeded(events: ActivityEvent[]): ActivityEvent[] {
  if (events.length <= MAX_EVENTS_PER_USER + EVICTION_BUFFER) return events;
  return [...events]
    .sort((a, b) => {
      const ta = parseInt(a.timestamp) || 0;
      const tb = parseInt(b.timestamp) || 0;
      return tb - ta;
    })
    .slice(0, MAX_EVENTS_PER_USER);
}

export const useActivityStore = create<ActivityState>()(
  persist(
    set => ({
      events: {},

      setEvents: (userId: string, events: ActivityEvent[]) => {
        set(
          produce(state => {
            state.events[userId] = events;
          }),
        );
      },

      upsertEvent: (userId: string, event: ActivityEvent) => {
        // Guard against invalid input
        if (!userId || !event) return;

        // All checks happen inside produce() to avoid TOCTOU races
        set(
          produce(state => {
            state.events[userId] = state.events[userId] || [];
            const idx = state.events[userId].findIndex((e: ActivityEvent) => isSameEvent(e, event));

            if (idx === -1) {
              state.events[userId].push(event);
              state.events[userId] = trimIfNeeded(state.events[userId]);
            } else {
              const existing = state.events[userId][idx];
              // Skip if nothing meaningfully changed
              if (!hasEventChanged(existing, event)) return;

              const mergedStatus =
                event.status && isStaleStatus(existing, event)
                  ? existing.status
                  : (event.status ?? existing.status);

              state.events[userId][idx] = {
                ...existing,
                ...stripNullish(event),
                status: mergedStatus,
                ...keptFromNewerCopy(existing, event),
              };
            }
          }),
        );
      },

      bulkUpsertEvent: (userId: string, events: ActivityEvent[]) => {
        // Guard against invalid input
        if (!userId || !events?.length) return;

        // All filtering happens inside produce() to avoid TOCTOU races:
        // getState() outside could return a stale snapshot that's outdated
        // by the time produce() executes.
        set(
          produce(state => {
            state.events[userId] = state.events[userId] || [];

            let changed = false;
            for (const event of events) {
              if (!event) continue;

              const existingIndex = state.events[userId].findIndex((e: ActivityEvent) =>
                isSameEvent(e, event),
              );

              if (existingIndex === -1) {
                state.events[userId].push(event);
                changed = true;
              } else {
                const existing = state.events[userId][existingIndex];
                if (hasEventChanged(existing, event)) {
                  const mergedStatus =
                    event.status && isStaleStatus(existing, event)
                      ? existing.status
                      : (event.status ?? existing.status);

                  const stripped = stripNullish(event);

                  state.events[userId][existingIndex] = {
                    ...existing,
                    ...stripped,
                    status: mergedStatus,
                    ...keptFromNewerCopy(existing, event),
                  };
                  changed = true;
                }
              }
            }

            if (changed) {
              state.events[userId] = trimIfNeeded(state.events[userId]);
            }
          }),
        );
      },

      removeEvents: () => {
        set(
          produce(state => {
            state.events = {};
          }),
        );
      },

      markDeleted: (userId: string, clientTxId: string, deletedAt: Date) => {
        if (!userId || !clientTxId || !deletedAt) return;

        set(
          produce(state => {
            if (!state.events[userId]) return;

            const existingIndex = state.events[userId].findIndex(
              (e: ActivityEvent) => e.clientTxId === clientTxId,
            );

            if (existingIndex !== -1) {
              state.events[userId][existingIndex] = {
                ...state.events[userId][existingIndex],
                deleted: true,
                deletedAt: deletedAt.toISOString(),
              };
            }
          }),
        );
      },

      removeActivity: (userId: string, clientTxId: string) => {
        if (!userId || !clientTxId) return;

        set(
          produce(state => {
            if (!state.events[userId]) return;

            state.events[userId] = state.events[userId].filter(
              (e: ActivityEvent) => e.clientTxId !== clientTxId,
            );
          }),
        );
      },
    }),
    {
      name: USER.activityStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.activityStorageKey)),
      // Validate and clean corrupted data on hydration
      onRehydrateStorage: () => state => {
        if (!state?.events) return;

        // Clean corrupted events on hydration
        let totalCorrupted = 0;
        const cleanedEvents: Record<string, ActivityEvent[]> = {};

        for (const [userId, events] of Object.entries(state.events)) {
          if (!Array.isArray(events)) {
            totalCorrupted++;
            cleanedEvents[userId] = [];
            continue;
          }

          const validEvents = events.filter(isValidActivity);
          const corruptedCount = events.length - validEvents.length;

          if (corruptedCount > 0) {
            totalCorrupted += corruptedCount;
          }

          cleanedEvents[userId] = trimIfNeeded(validEvents);
        }

        // Always apply cleaned (and trimmed) events — the trimIfNeeded call
        // is a no-op when under the cap, so this is safe and simple.
        state.events = cleanedEvents;
      },
    },
  ),
);
