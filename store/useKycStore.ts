import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

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
}

const KYC_STORAGE_KEY = 'kyc-store';

export const useKycStore = create<KycState>()(
  persist(
    set => ({
      kycLinkId: null,
      processingUntil: null,
      diditSessionId: null,

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
    }),
    {
      name: KYC_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(KYC_STORAGE_KEY)),
    },
  ),
);
