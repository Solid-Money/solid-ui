import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { KycStatus } from '@/lib/types';
import mmkvStorage from '@/lib/mmvkStorage';

interface KycState {
  kycLinkId: string | null;
  setKycLinkId: (kycLinkId: string) => void;
  clearKycLinkId: () => void;
  processingUntil: number | null;
  setProcessingUntil: (ts: number) => void;
  clearProcessingUntil: () => void;
  /** Rain KYC: status from POST /cards/kyc/persona; only allow card creation when 'approved' */
  rainKycStatus: KycStatus | null;
  setRainKycStatus: (status: KycStatus | null) => void;
}

const KYC_STORAGE_KEY = 'kyc-store';

export const useKycStore = create<KycState>()(
  persist(
    set => ({
      kycLinkId: null,
      processingUntil: null,
      rainKycStatus: null,

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

      setRainKycStatus: (rainKycStatus: KycStatus | null) => {
        set({ rainKycStatus });
      },
    }),
    {
      name: KYC_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(KYC_STORAGE_KEY)),
    },
  ),
);
