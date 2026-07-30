import { create } from 'zustand';

interface SupportDrawerState {
  isOpen: boolean;
  chatMessage?: string;
  open: (chatMessage?: string) => void;
  close: () => void;
}

export const useSupportDrawerStore = create<SupportDrawerState>()(set => ({
  isOpen: false,
  chatMessage: undefined,
  open: chatMessage => set({ isOpen: true, chatMessage }),
  close: () => set({ isOpen: false, chatMessage: undefined }),
}));

export const openSupportDrawer = (chatMessage?: string) => {
  useSupportDrawerStore.getState().open(chatMessage);
};

export const closeSupportDrawer = () => {
  useSupportDrawerStore.getState().close();
};
