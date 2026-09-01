import { create } from 'zustand';

interface SupportDrawerState {
  isOpen: boolean;
  chatMessage?: string;
  open: (chatMessage?: string) => void;
  close: () => void;
}

/**
 * `openSupportDrawer` reads as a bare handler, so it gets wired straight into
 * `onPress` — and `onPress: () => void` happily accepts it, because a function
 * with an optional parameter satisfies one with none. At runtime Pressable then
 * hands it a press event, which travelled all the way into Intercom's native
 * message composer and hard-crashed the app: that API takes a string only.
 * Anything that is not a usable message means "no prefilled message".
 */
const asChatMessage = (chatMessage?: unknown): string | undefined =>
  typeof chatMessage === 'string' && chatMessage.trim() !== '' ? chatMessage : undefined;

export const useSupportDrawerStore = create<SupportDrawerState>()(set => ({
  isOpen: false,
  chatMessage: undefined,
  open: chatMessage => set({ isOpen: true, chatMessage: asChatMessage(chatMessage) }),
  close: () => set({ isOpen: false, chatMessage: undefined }),
}));

export const openSupportDrawer = (chatMessage?: string) => {
  useSupportDrawerStore.getState().open(chatMessage);
};

export const closeSupportDrawer = () => {
  useSupportDrawerStore.getState().close();
};
