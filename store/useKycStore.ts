import mmkvStorage from '@/lib/mmvkStorage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface KycState {
  kycLinkId: string | null;
  setKycLinkId: (kycLinkId: string) => void;
  clearKycLinkId: () => void;
  processingUntil: number | null;
  setProcessingUntil: (ts: number) => void;
  clearProcessingUntil: () => void;
}

const KYC_STORAGE_KEY = 'kyc-store';

export const useKycStore = create<KycState>()(
  persist(
    set => ({
      kycLinkId: null,
      processingUntil: null,

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
    }),
    {
      name: KYC_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(KYC_STORAGE_KEY)),
    },
  ),
);
