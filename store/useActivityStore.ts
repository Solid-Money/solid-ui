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
              const existingEvent = state.events[userId].find(
                (e: ActivityEvent) =>
                  e.clientTxId === event.clientTxId
              );

              if (!existingEvent) {
                state.events[userId].push(event);
                state.createEventPromises[userId] = state.createEventPromises[userId] || [];
                state.createEventPromises[userId].push(withRefreshToken(() => createActivityEvent(event)));
                return;
              }

              if (
                existingEvent.status !== event.status ||
                existingEvent.hash !== event.hash
              ) {
                state.updateEventPromises[userId] = state.updateEventPromises[userId] || [];
                state.updateEventPromises[userId].push(withRefreshToken(() => updateActivityEvent(event.clientTxId, event)));
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
