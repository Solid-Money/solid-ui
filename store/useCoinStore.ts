import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { times } from '@/constants/coins';

interface CoinState {
  selectedTime: string;
  setSelectedTime: (time: string) => void;
}

export const useCoinStore = create<CoinState>()(
  persist(
    set => ({
      selectedTime: times[0].value,

      setSelectedTime: (time: string) => {
        set({ selectedTime: time });
      },
    }),
    {
      name: USER.coinStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.coinStorageKey)),
    },
  ),
);
