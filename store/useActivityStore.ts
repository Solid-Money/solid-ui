import { produce } from 'immer';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createActivityEvent, updateActivityEvent } from '@/lib/api';
import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { ActivityEvent } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

interface ActivityState {
  events: Record<string, ActivityEvent[]>;
  createEventPromises: Record<string, Promise<ActivityEvent>[]>;
  updateEventPromises: Record<string, Promise<ActivityEvent>[]>;
  storeEvents: (userId: string, events: ActivityEvent[]) => void;
  createEvents: (userId: string) => Promise<void>;
  updateEvents: (userId: string) => Promise<void>;
  removeEvents: () => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    set => ({
      events: {},
      createEventPromises: {},
      updateEventPromises: {},

      storeEvents: (userId: string, events: ActivityEvent[]) => {
        set(
          produce(state => {
            state.events[userId] = state.events[userId] || [];

            events.forEach((event: ActivityEvent) => {
              // Find existing event by multiple identifiers
              const existingEvent = state.events[userId].find(
                (e: ActivityEvent) => {
                  const match =
                    e.clientTxId === event.clientTxId ||
                    (e.userOpHash && e.userOpHash === event.userOpHash) ||
                    (e.hash && e.hash === event.hash) ||
                    (e.clientTxId === event.userOpHash) || // Local clientTxId might be userOpHash
                    (e.clientTxId === event.hash); // Local clientTxId might be hash

                  return match;
                }
              );

              if (!existingEvent) {
                state.events[userId].push(event);
                state.createEventPromises[userId] = state.createEventPromises[userId] || [];
                state.createEventPromises[userId].push(withRefreshToken(() => createActivityEvent(event)));
                return;
              }

              // Update existing event if status or hash changed
              if (
                existingEvent.status !== event.status ||
                existingEvent.hash !== event.hash ||
                existingEvent.userOpHash !== event.userOpHash
              ) {
                // Replace the existing event with the new one
                const index = state.events[userId].indexOf(existingEvent);
                if (index !== -1) {
                  state.events[userId][index] = {
                    ...existingEvent,
                    ...event,
                  };
                }

                // Only send update to server if it's not already confirmed
                if (existingEvent.status !== 'success' && existingEvent.status !== 'failed') {
                  state.updateEventPromises[userId] = state.updateEventPromises[userId] || [];
                  state.updateEventPromises[userId].push(withRefreshToken(() => updateActivityEvent(event.clientTxId, event)));
                }
              }
            });

            state.createEvents(userId);
            state.updateEvents(userId);
          }),
        );
      },

      createEvents: async (userId: string) => {
        try {
          const state = useActivityStore.getState();
          const promises = state.createEventPromises[userId] || [];
          await Promise.allSettled<ActivityEvent>(promises);

          set(
            produce(state => {
              state.createEventPromises[userId] = [];
            })
          );
        } catch (error) {
          console.error('Failed to create Activity events:', error);
        }
      },

      updateEvents: async (userId: string) => {
        try {
          const state = useActivityStore.getState();
          const promises = state.updateEventPromises[userId] || [];
          const updatedEvents = await Promise.allSettled<ActivityEvent>(promises);

          set(
            produce(state => {
              state.updateEventPromises[userId] = [];
              state.events[userId] = state.events[userId] || [];

              state.events[userId] = state.events[userId].map((event: ActivityEvent) => {
                const updatedEvent = updatedEvents.find(
                  (e: PromiseSettledResult<ActivityEvent>) =>
                    e.status === 'fulfilled' &&
                    e.value.clientTxId === event.clientTxId
                );

                return updatedEvent ?? event;
              });
            })
          );
        } catch (error) {
          console.error('Failed to update Activity events:', error);
        }
      },

      removeEvents: () => {
        set(
          produce(state => {
            state.events = {};
          })
        );
      },
    }),
    {
      name: USER.activityStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.activityStorageKey)),
    },
  ),
);
