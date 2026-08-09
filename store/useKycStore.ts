import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';
import { KycProvider } from '@/lib/types';

export type KycFlow = 'card' | 'va';

interface KycState {
  kycLinkId: string | null;
  setKycLinkId: (kycLinkId: string) => void;
  clearKycLinkId: () => void;
  processingUntil: number | null;
  setProcessingUntil: (ts: number) => void;
  clearProcessingUntil: () => void;
  /** Didit verification session ID (from backend). */
  diditSessionId: string | null;
  setDiditSessionId: (sessionId: string) => void;
  clearDiditSessionId: () => void;
  /**
   * Epoch ms of the first time each user opened the verification SDK, keyed by
   * userId. Local-only marker: a user who abandons Didit mid-flow leaves no
   * server-side trace for a while, so this is what tells us they started at
   * all. Keyed per user because the device is shared between accounts — a
   * global flag would follow the next account that signs in, and would be lost
   * on any re-login.
   */
  kycStartedAt: Record<string, number>;
  markKycStarted: (userId: string) => void;
  clearKycStartedAt: (userId: string) => void;
  /** Which product initiated KYC — drives post-KYC routing. */
  kycFlow: KycFlow | null;
  setKycFlow: (flow: KycFlow) => void;
  clearKycFlow: () => void;
  /** Which KYC provider the user was routed to (Didit vs Sumsub) by jurisdiction. */
  kycProvider: KycProvider | null;
  setKycProvider: (provider: KycProvider) => void;
  clearKycProvider: () => void;
}

const KYC_STORAGE_KEY = 'kyc-store';

export const useKycStore = create<KycState>()(
  persist(
    (set, get) => ({
      kycLinkId: null,
      processingUntil: null,
      diditSessionId: null,
      kycFlow: null,
      kycProvider: null,
      kycStartedAt: {},

      setKycLinkId: (kycLinkId: string) => {
        set({ kycLinkId });
      },

      clearKycLinkId: () => {
        set({ kycLinkId: null, processingUntil: null });
      },

      setProcessingUntil: (ts: number) => {
        set({ processingUntil: ts });
      },

      clearProcessingUntil: () => {
        set({ processingUntil: null });
      },

      setDiditSessionId: (sessionId: string) => {
        set({ diditSessionId: sessionId });
      },

      clearDiditSessionId: () => {
        set({ diditSessionId: null });
      },

      markKycStarted: (userId: string) => {
        // Keep the first timestamp: it dates the start of the attempt, and
        // re-opening the SDK on a retry shouldn't reset that.
        if (get().kycStartedAt[userId] != null) return;
        set(state => ({ kycStartedAt: { ...state.kycStartedAt, [userId]: Date.now() } }));
      },

      clearKycStartedAt: (userId: string) => {
        set(state => {
          const { [userId]: _removed, ...rest } = state.kycStartedAt;
          return { kycStartedAt: rest };
        });
      },

      setKycFlow: (flow: KycFlow) => {
        set({ kycFlow: flow });
      },

      clearKycFlow: () => {
        set({ kycFlow: null });
      },

      setKycProvider: (provider: KycProvider) => {
        set({ kycProvider: provider });
      },

      clearKycProvider: () => {
        set({ kycProvider: null });
      },
    }),
    {
      name: KYC_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(KYC_STORAGE_KEY)),
    },
  ),
);
