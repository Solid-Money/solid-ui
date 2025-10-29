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
}

// Helper to check if two events are the same
function isSameEvent(a: ActivityEvent, b: ActivityEvent): boolean {
  return (
    a.clientTxId === b.clientTxId ||
    (a.userOpHash && a.userOpHash === b.userOpHash) ||
    (a.hash && a.hash === b.hash) ||
    a.clientTxId === b.userOpHash ||
    a.clientTxId === b.hash
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
        set(
          produce(state => {
            state.events[userId] = state.events[userId] || [];
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
          }),
        );
      },

      bulkUpsertEvent: (userId: string, events: ActivityEvent[]) => {
        set(
          produce(state => {
            state.events[userId] = state.events[userId] || [];
            for (const event of events) {
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
    }),
    {
      name: USER.activityStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.activityStorageKey)),
    },
  ),
);
