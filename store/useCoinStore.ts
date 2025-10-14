import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { times } from '@/constants/coins';

interface CoinState {
  selectedTime: string;
  setSelectedTime: (time: string) => void;
  selectedPrice: number | null;
  setSelectedPrice: (price: number | null) => void;
  selectedPriceChange: number | null;
  setSelectedPriceChange: (priceChange: number | null) => void;
}

export const useCoinStore = create<CoinState>()(
  persist(
    set => ({
      selectedTime: times[0].value,
      selectedPrice: null,
      selectedPriceChange: null,

      setSelectedTime: (time: string) => {
        set({ selectedTime: time });
      },
      setSelectedPrice: (price: number | null) => {
        set({ selectedPrice: price });
      },
      setSelectedPriceChange: (priceChange: number | null) => {
        set({ selectedPriceChange: priceChange });
      },
    }),
    {
      name: USER.coinStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.coinStorageKey)),
    },
  ),
);
