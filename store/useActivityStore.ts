import { produce } from 'immer';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { ActivityEvent } from '@/lib/types';

interface ActivityState {
  events: Record<string, ActivityEvent[]>;
  setEvents: (userId: string, events: ActivityEvent[]) => void;
  upsertEvent: (userId: string, event: ActivityEvent) => void;
  bulkUpsertEvent: (userId: string, events: ActivityEvent[]) => void;
  removeEvents: () => void;
  markDeleted: (userId: string, clientTxId: string, deletedAt: Date) => void;
  removeActivity: (userId: string, clientTxId: string) => void;
}

// Helper to check if two events are the same
function isSameEvent(a: ActivityEvent, b: ActivityEvent): boolean {
  // Guard against undefined/null events
  if (!a || !b) return false;

  return (
    a.clientTxId === b.clientTxId ||
    (a.userOpHash && a.userOpHash === b.userOpHash) ||
    (a.hash && a.hash === b.hash) ||
    a.clientTxId === b.userOpHash ||
    a.clientTxId === b.hash
  );
}

// Helper to check if event data has actually changed
function hasEventChanged(existing: ActivityEvent, incoming: ActivityEvent): boolean {
  // Compare key fields that would indicate a meaningful change
  return (
    existing.status !== incoming.status ||
    existing.hash !== incoming.hash ||
    existing.deleted !== incoming.deleted ||
    existing.failureReason !== incoming.failureReason
  );
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

        // Check if update is needed BEFORE calling set() to prevent unnecessary re-renders
        const currentState = useActivityStore.getState();
        const userEvents = currentState.events[userId] || [];
        const existingIndex = userEvents.findIndex((e: ActivityEvent) => isSameEvent(e, event));

        if (existingIndex !== -1) {
          // Event exists - check if it actually changed
          const existing = userEvents[existingIndex];
          if (!hasEventChanged(existing, event)) {
            // No meaningful change - skip update entirely
            return;
          }
        }

        // Now we know there's a real change, proceed with update
        set(
          produce(state => {
            state.events[userId] = state.events[userId] || [];
            const idx = state.events[userId].findIndex((e: ActivityEvent) =>
              isSameEvent(e, event),
            );

            if (idx === -1) {
              state.events[userId].push(event);
            } else {
              state.events[userId][idx] = {
                ...state.events[userId][idx],
                ...event,
              };
            }
          }),
        );
      },

      bulkUpsertEvent: (userId: string, events: ActivityEvent[]) => {
        // Guard against invalid input
        if (!userId || !events?.length) return;

        // Filter to only events that are new or have changed
        const currentState = useActivityStore.getState();
        const userEvents = currentState.events[userId] || [];

        const eventsToUpdate = events.filter(event => {
          if (!event) return false;
          const existingIndex = userEvents.findIndex((e: ActivityEvent) => isSameEvent(e, event));
          if (existingIndex === -1) return true; // New event
          return hasEventChanged(userEvents[existingIndex], event); // Changed event
        });

        // If nothing to update, skip entirely
        if (!eventsToUpdate.length) return;

        set(
          produce(state => {
            state.events[userId] = state.events[userId] || [];
            for (const event of eventsToUpdate) {
              const existingIndex = state.events[userId].findIndex((e: ActivityEvent) =>
                isSameEvent(e, event),
              );

              if (existingIndex === -1) {
                state.events[userId].push(event);
              } else {
                state.events[userId][existingIndex] = {
                  ...state.events[userId][existingIndex],
                  ...event,
                };
              }
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
    },
  ),
);
