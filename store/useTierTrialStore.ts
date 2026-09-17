import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

interface TierTrialState {
  /** Ids of the trials whose offer popup has already opened by itself. */
  offerSeen: Record<string, true>;
  markOfferSeen: (trialId: string) => void;
}

const TIER_TRIAL_STORAGE_KEY = 'tier-trial-storage';

/**
 * Which trial offers this device has already volunteered the popup for.
 *
 * The offer popup opens by itself once and then waits to be asked: the product
 * rule is that "Maybe later" dismisses the popup and leaves the offer
 * claimable, which is only true if it does not reappear unbidden on every
 * launch. The banner is what stays, and tapping it opens the popup again.
 *
 * Keyed by trial id rather than by user, so a second gift after the first has
 * ended gets its own popup — "seen" is about a particular offer, not about
 * trials in general.
 *
 * This is not a rejection and it is not authoritative. The offer lives on the
 * account, so losing the store — a reinstall, cleared storage — costs nothing
 * worse than being shown the gift once more.
 */
export const useTierTrialStore = create<TierTrialState>()(
  persist(
    set => ({
      offerSeen: {},
      markOfferSeen: (trialId: string) =>
        set(state => ({ offerSeen: { ...state.offerSeen, [trialId]: true } })),
    }),
    {
      name: TIER_TRIAL_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(TIER_TRIAL_STORAGE_KEY)),
    },
  ),
);
