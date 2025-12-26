import { create } from 'zustand';

interface CarouselState {
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
}

export const useCarouselStore = create<CarouselState>()(set => ({
  currentIndex: 0,
  setCurrentIndex: (index: number) => set({ currentIndex: index }),
}));
