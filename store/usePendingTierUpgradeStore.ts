import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

import type { RewardsTier } from '@/lib/types';

/**
 * A `transfer`-mode upgrade that was sent but not yet confirmed to the backend.
 *
 * Unlike a module subscription, where the backend takes the money and a retry
 * only re-signs a mandate, this one pays the treasury from the Safe itself. A
 * retry after a lost confirm — or after a receipt wait that gave up — would pay
 * a second time. The record is what makes the next press finish the first
 * payment instead of sending another.
 *
 * Its identity is the Safe and the nonce, not the operation's hash. It is
 * written before anything is signed, with the nonce the operation is then sent
 * with, so a payment the bundler accepts is always on record — even when the
 * answer that carries its hash is lost, or the app stops before it arrives.
 * Whatever uses that nonce is what settles it.
 */
export interface PendingTierUpgrade {
  /**
   * The latest operation's hash, once the bundler has accepted it. Absent
   * while it is being signed and sent, and after a send whose outcome is
   * unknown — it may have been accepted all the same.
   *
   * Always present on a record written before the nonce became its identity.
   */
  userOpHash?: `0x${string}`;
  /** Whose upgrade it is. */
  userId: string;
  /** When the latest operation was sent — or, until it is, written — ms since epoch. */
  submittedAt: number;
  /** The tier the latest operation pays for. */
  tier: RewardsTier;
  /**
   * The Safe that sends it, and the EntryPoint nonce it is sent with — a
   * decimal string, since the record is persisted as JSON and JSON has no
   * bigint.
   *
   * A user operation carries no expiry of ours, so "the bundler has no receipt
   * for it" never on its own means it cannot still land. Its nonce does: once
   * the Safe's nonce has moved past this one, exactly one operation used it,
   * and nothing else sent with it can ever be included. See
   * `settlePendingTierUpgrades`.
   */
  sender?: string;
  nonce?: string;
  /**
   * The latest Fuse block, read before the nonce was — a decimal string, like
   * the nonce. Whatever uses the nonce is included at or after it, so a search
   * of the chain for that operation starts here.
   *
   * The sender, the nonce and the block are on every record written now. A
   * record missing any of them was written by an unreleased build of this
   * feature, and goes on the TTL alone — see `PENDING_TIER_UPGRADE_TTL_MS`.
   */
  block?: string;
  /**
   * Earlier operations this one replaced: sent from the same Safe with the
   * same nonce, newest first, each with its hash if the bundler's answer
   * carrying it arrived. Only one operation with a nonce can ever be included,
   * but until the nonce is used it is not known which — any of these may
   * still be the one that lands, and is confirmed as the tier it paid for if
   * it does.
   */
  replaced?: { userOpHash?: `0x${string}`; tier: RewardsTier }[];
  /**
   * Set when settling found it has not landed and may be replaced: its nonce
   * unused, and the bundler no longer holding it, the hold over, or no hash
   * to ask the bundler about. There is
   * nothing to confirm, so no screen waits on it; the record stays until its
   * nonce is used — by it after all, or by the payment that replaces it.
   */
  replaceable?: boolean;
  /** Set once the transaction is known to have landed. */
  transactionHash?: string;
  /**
   * Set when `transactionHash` is the one that used the nonce, found on the
   * chain, and it is none of this record's operations with a hash. It may be
   * the one whose hash never arrived — or another operation of the Safe's
   * that took the nonce first. The backend tells them apart: finding no
   * payment from the wallet in it means nothing was paid for this upgrade.
   */
  unmatched?: boolean;
  /**
   * When the backend first refused to start a membership from this payment,
   * ms since epoch. The money is at the treasury and support has been alerted;
   * the record is kept a while so a retry cannot pay again before they act.
   */
  rejectedAt?: number;
}

/**
 * Where a record is kept: by its Safe and nonce, which every operation that
 * may still pay for it shares. A record from before the nonce was kept goes
 * by the hash it always had.
 *
 * Records written by unreleased builds of this feature may be kept under
 * their hash all the same, so whatever settles records goes by the key each
 * is stored under (`pendingTierUpgradesFor`), not this.
 */
export const pendingTierUpgradeKey = (upgrade: PendingTierUpgrade): string =>
  upgrade.sender && upgrade.nonce !== undefined
    ? `${upgrade.sender.toLowerCase()}:${upgrade.nonce}`
    : (upgrade.userOpHash ?? '');

interface PendingTierUpgradeState {
  /** By `pendingTierUpgradeKey`. */
  upgrades: Record<string, PendingTierUpgrade>;
  /** Write a record, over any already kept for its Safe and nonce. */
  remember: (upgrade: PendingTierUpgrade) => void;
  /** It landed after all, so it is a payment to confirm again, not one to replace. */
  landed: (key: string, transactionHash: string) => void;
  /** Stamp the first refusal; later ones keep the original time. */
  rejected: (key: string, at: number) => void;
  markReplaceable: (key: string) => void;
  /**
   * Swap one record for another in a single write: a record for the one that
   * replaces its operation, or for the operation that used its nonce.
   */
  replace: (key: string, upgrade: PendingTierUpgrade) => void;
  forget: (key: string) => void;
}

const PENDING_TIER_UPGRADE_STORAGE_KEY = 'pending-tier-upgrade-storage';

/** Persisted, so a payment sent just before the app was killed is still finished, not repeated. */
export const usePendingTierUpgradeStore = create<PendingTierUpgradeState>()(
  persist(
    set => ({
      upgrades: {},
      remember: upgrade =>
        set(state => ({
          upgrades: { ...state.upgrades, [pendingTierUpgradeKey(upgrade)]: upgrade },
        })),
      landed: (key, transactionHash) =>
        set(state => {
          const upgrade = state.upgrades[key];
          if (!upgrade) return state;
          return {
            upgrades: {
              ...state.upgrades,
              [key]: { ...upgrade, transactionHash, replaceable: undefined },
            },
          };
        }),
      rejected: (key, at) =>
        set(state => {
          const upgrade = state.upgrades[key];
          if (!upgrade || upgrade.rejectedAt) return state;
          return { upgrades: { ...state.upgrades, [key]: { ...upgrade, rejectedAt: at } } };
        }),
      markReplaceable: key =>
        set(state => {
          const upgrade = state.upgrades[key];
          if (!upgrade || upgrade.replaceable) return state;
          return {
            upgrades: { ...state.upgrades, [key]: { ...upgrade, replaceable: true } },
          };
        }),
      replace: (key, upgrade) =>
        set(state => {
          const { [key]: _replaced, ...upgrades } = state.upgrades;
          return { upgrades: { ...upgrades, [pendingTierUpgradeKey(upgrade)]: upgrade } };
        }),
      forget: key =>
        set(state => {
          if (!state.upgrades[key]) return state;
          const { [key]: _forgotten, ...upgrades } = state.upgrades;
          return { upgrades };
        }),
    }),
    {
      name: PENDING_TIER_UPGRADE_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(PENDING_TIER_UPGRADE_STORAGE_KEY)),
    },
  ),
);

/**
 * Whether an account has an upgrade payment still to confirm, for a screen
 * that has to re-render when one is remembered or settled.
 *
 * Not one found `replaceable`: it never landed, so there is nothing to
 * confirm, and the screen goes back to paying — which replaces it. Nor one
 * with no hash: written before signing, it is only an attempt until the
 * bundler accepts it, and the screen does not change under a passkey prompt.
 * One a send of unknown outcome left without a hash is settled by the next
 * press to pay — confirmed if its nonce was used by the payment, replaced
 * with that same nonce if not.
 */
export const useHasPendingTierUpgrade = (userId: string | undefined): boolean =>
  usePendingTierUpgradeStore(
    state =>
      !!userId &&
      Object.values(state.upgrades).some(
        upgrade => upgrade.userId === userId && !!upgrade.userOpHash && !upgrade.replaceable,
      ),
  );

/** One account's unconfirmed upgrades, oldest first, each with the key it is kept under. */
export const pendingTierUpgradesFor = (
  userId: string,
): { key: string; upgrade: PendingTierUpgrade }[] =>
  Object.entries(usePendingTierUpgradeStore.getState().upgrades)
    .filter(([, upgrade]) => upgrade.userId === userId)
    .sort(([, a], [, b]) => a.submittedAt - b.submittedAt)
    .map(([key, upgrade]) => ({ key, upgrade }));
