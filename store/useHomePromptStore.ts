import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

/** The home prompt-card variants a user can dismiss, one snooze timer each. */
export type HomePromptKey = 'verification' | 'fund' | 'apple-pay';

/**
 * How long a dismissed prompt stays hidden. Dismissing is a "not now", not a
 * "never" — the card comes back after three days so the user still gets nudged
 * through onboarding.
 */
export const HOME_PROMPT_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

interface HomePromptState {
  /** Epoch ms of the last dismissal, per variant. */
  dismissedAt: Partial<Record<HomePromptKey, number>>;
  dismiss: (key: HomePromptKey) => void;
}

const HOME_PROMPT_STORAGE_KEY = 'home-prompt-storage';

export const useHomePromptStore = create<HomePromptState>()(
  persist(
    set => ({
      dismissedAt: {},
      dismiss: (key: HomePromptKey) =>
        set(state => ({ dismissedAt: { ...state.dismissedAt, [key]: Date.now() } })),
    }),
    {
      name: HOME_PROMPT_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(HOME_PROMPT_STORAGE_KEY)),
    },
  ),
);

/** Whether `key` was dismissed recently enough that it should stay hidden. */
export function isHomePromptSnoozed(
  dismissedAt: HomePromptState['dismissedAt'],
  key: HomePromptKey,
  now = Date.now(),
): boolean {
  const at = dismissedAt[key];
  // A timestamp in the future (clock moved back) would otherwise hide the card
  // for good, so treat anything outside the window as expired.
  return at !== undefined && now >= at && now - at < HOME_PROMPT_SNOOZE_MS;
}
