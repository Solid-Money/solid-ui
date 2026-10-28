import { useUserStore } from '@/store/useUserStore';

// Token refreshes keep the account; switching away and back starts a new scope.
let generation = 0;
useUserStore.subscribe((state, previous) => {
  const selected = state.users.find(user => user.selected)?.userId;
  const before = previous.users.find(user => user.selected)?.userId;
  if (selected !== before) generation++;
});

/** Bind asynchronous work to the account that initiated it, including sign-out. */
export const captureAccountScope = () => {
  const started = generation;
  const isCurrent = () => started === generation;
  return {
    generation: started,
    isCurrent,
    assertCurrent: () => {
      if (!isCurrent()) {
        const error = new Error('The account changed');
        error.name = 'AbortError';
        throw error;
      }
    },
  };
};
