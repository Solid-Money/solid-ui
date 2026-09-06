import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

/**
 * The home CTA banner variants, one per step of the card funnel (Figma
 * 25141:6965). Exactly one is shown under the wallet card at a time — whichever
 * step the user is actually on.
 *
 * `cashback` is the terminal state and deliberately has no close button, so it
 * carries no snooze timer; see {@link DismissibleHomePromptKey}.
 */
export type HomePromptKey =
  /** Never entered verification — "Get your card". */
  | 'get-card'
  /** Entered verification and walked away — "Finish verification". */
  | 'verification'
  /** Waiting on a decision — "Your card is on its way". */
  | 'kyc-review'
  /** Verification declined — "Your verification declined". */
  | 'kyc-rejected'
  /** Verified, card not issued yet — "Your Solid card is ready!". */
  | 'activate-card'
  /** Card issued, account unfunded — "Fund your wallet". */
  | 'fund'
  /** Funded card that isn't in Apple/Google Wallet — "Add to Apple Pay". */
  | 'add-to-wallet'
  /** Everything done — the cashback banner, which never goes away. */
  | 'cashback';

/** Every banner except the terminal cashback one, which cannot be dismissed. */
export type DismissibleHomePromptKey = Exclude<HomePromptKey, 'cashback'>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long a dismissed banner stays hidden, per variant. Dismissing is a
 * "not now", not a "never" — the banner comes back later so the user still gets
 * nudged through the funnel.
 *
 * The two verification-effort steps snooze for a week rather than the three days
 * the lighter nudges use: they are the steps with real work behind them
 * (documents, a selfie) or with nothing the user can do about them yet, so
 * coming back sooner reads as pestering. A declined verification is the same
 * story for the opposite reason — repeating bad news every three days is worse
 * than saying it once.
 */
export const HOME_PROMPT_SNOOZE_MS: Record<DismissibleHomePromptKey, number> = {
  'get-card': 3 * DAY_MS,
  verification: 7 * DAY_MS,
  'kyc-review': 3 * DAY_MS,
  'kyc-rejected': 7 * DAY_MS,
  'activate-card': 3 * DAY_MS,
  fund: 3 * DAY_MS,
  'add-to-wallet': 3 * DAY_MS,
};

/** Whether this banner offers a ✕ at all — the cashback one does not. */
export function isHomePromptDismissible(key: HomePromptKey): key is DismissibleHomePromptKey {
  return key !== 'cashback';
}

interface HomePromptState {
  /** Epoch ms of the last dismissal, per variant. */
  dismissedAt: Partial<Record<DismissibleHomePromptKey, number>>;
  dismiss: (key: DismissibleHomePromptKey) => void;
}

const HOME_PROMPT_STORAGE_KEY = 'home-prompt-storage';

/**
 * Bumped when `apple-pay` became `add-to-wallet` — the banner covers Google
 * Wallet too now, so the key that names only Apple was misleading. Migrating
 * rather than leaving both keys around means an Android user's dismissal is
 * still honoured and no dead entry lingers in storage.
 */
const HOME_PROMPT_STORAGE_VERSION = 1;

type PersistedHomePrompt = { dismissedAt?: Record<string, number> };

export const useHomePromptStore = create<HomePromptState>()(
  persist(
    set => ({
      dismissedAt: {},
      dismiss: (key: DismissibleHomePromptKey) =>
        set(state => ({ dismissedAt: { ...state.dismissedAt, [key]: Date.now() } })),
    }),
    {
      name: HOME_PROMPT_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(HOME_PROMPT_STORAGE_KEY)),
      version: HOME_PROMPT_STORAGE_VERSION,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as PersistedHomePrompt;
        if (version >= HOME_PROMPT_STORAGE_VERSION) return state as HomePromptState;
        const { 'apple-pay': applePay, ...rest } = state.dismissedAt ?? {};
        return {
          ...state,
          dismissedAt: {
            ...rest,
            // Only carry the old timestamp over when nothing has been written
            // under the new key, so a fresh dismissal always wins.
            ...(applePay !== undefined && rest['add-to-wallet'] === undefined
              ? { 'add-to-wallet': applePay }
              : {}),
          },
        } as HomePromptState;
      },
    },
  ),
);

/** A variant's snooze window in days — for analytics payloads. */
export function homePromptSnoozeDays(key: HomePromptKey): number {
  if (!isHomePromptDismissible(key)) return 0;
  return HOME_PROMPT_SNOOZE_MS[key] / DAY_MS;
}

/** Whether `key` was dismissed recently enough that it should stay hidden. */
export function isHomePromptSnoozed(
  dismissedAt: HomePromptState['dismissedAt'],
  key: HomePromptKey,
  now = Date.now(),
): boolean {
  // The cashback banner has no ✕, so it is never snoozed — see HomePromptKey.
  if (!isHomePromptDismissible(key)) return false;
  const at = dismissedAt[key];
  // A timestamp in the future (clock moved back) would otherwise hide the card
  // for good, so treat anything outside the window as expired.
  return at !== undefined && now >= at && now - at < HOME_PROMPT_SNOOZE_MS[key];
}
