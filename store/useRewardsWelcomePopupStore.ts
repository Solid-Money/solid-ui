import { create } from 'zustand';

interface RewardsWelcomePopupState {
  /** Session-only flag: the user dismissed the opt-in popup without joining. */
  dismissed: boolean;
  setDismissed: (value: boolean) => void;
}

/**
 * Tracks whether the rewards opt-in welcome popup has been dismissed in the
 * current session. It is intentionally NOT persisted: the backend `hasOptedIn`
 * flag is the source of truth for whether the user has joined, so we re-prompt
 * users who haven't joined on the next session while avoiding nagging within
 * a single session.
 */
export const useRewardsWelcomePopupStore = create<RewardsWelcomePopupState>(set => ({
  dismissed: false,
  setDismissed: (value: boolean) => set({ dismissed: value }),
}));
