import mmkvStorage from '@/lib/mmvkStorage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface KycState {
  kycLinkId: string | null;
  setKycLinkId: (kycLinkId: string) => void;
  clearKycLinkId: () => void;
}

const KYC_STORAGE_KEY = 'kyc-store';

export const useKycStore = create<KycState>()(
  persist(
    set => ({
      kycLinkId: null,

      setKycLinkId: (kycLinkId: string) => {
        set({ kycLinkId });
      },

      clearKycLinkId: () => {
        set({ kycLinkId: null });
      },
    }),
    {
      name: KYC_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(KYC_STORAGE_KEY)),
    },
  ),
);
