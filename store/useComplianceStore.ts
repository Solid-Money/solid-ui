import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

interface ComplianceState {
  acceptedDisclaimers: Record<string, boolean>;
  acceptDisclaimer: (feature: string) => void;
  hasAcceptedDisclaimer: (feature: string) => boolean;
}

const COMPLIANCE_STORAGE_KEY = 'compliance-storage';

export const useComplianceStore = create<ComplianceState>()(
  persist(
    (set, get) => ({
      acceptedDisclaimers: {},

      acceptDisclaimer: (feature: string) => {
        set(state => ({
          acceptedDisclaimers: {
            ...state.acceptedDisclaimers,
            [feature]: true,
          },
        }));
      },

      hasAcceptedDisclaimer: (feature: string) => {
        if (Platform.OS !== 'ios') return true;
        return get().acceptedDisclaimers[feature] === true;
      },
    }),
    {
      name: COMPLIANCE_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(COMPLIANCE_STORAGE_KEY)),
    },
  ),
);
