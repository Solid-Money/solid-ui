import { create } from 'zustand';

import { SUPPORT_CONTEXT_KINDS, SupportContextKind } from '@/lib/types/support';

import type { SupportDraftContext } from '@/store/useSupportChatStore';

/**
 * What a "contact support" button knows about where it was pressed. Intercom
 * gets `chatMessage`, a prefilled draft; the in-house chat gets `context`, a
 * reference the server resolves itself (the app never sends amounts).
 */
export interface SupportDrawerRequest {
  chatMessage?: string;
  context?: SupportDraftContext;
}

interface SupportDrawerState {
  isOpen: boolean;
  chatMessage?: string;
  context?: SupportDraftContext;
  open: (request?: string | SupportDrawerRequest) => void;
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

/** Same guard for the typed request: a press event is an object too. */
const asContext = (context?: unknown): SupportDraftContext | undefined => {
  if (typeof context !== 'object' || context === null) return undefined;
  const { kind, id, label } = context as Record<string, unknown>;
  // The server refuses a kind it does not know, which would fail the user's message.
  if (!SUPPORT_CONTEXT_KINDS.includes(kind as SupportContextKind)) return undefined;
  return {
    kind: kind as SupportContextKind,
    id: typeof id === 'string' && /^[A-Za-z0-9:_\-.]{1,100}$/.test(id) ? id : undefined,
    label: typeof label === 'string' && label ? label : undefined,
  };
};

const asRequest = (request?: unknown): SupportDrawerRequest => {
  if (typeof request === 'string') return { chatMessage: asChatMessage(request) };
  if (
    typeof request !== 'object' ||
    request === null ||
    !('chatMessage' in request || 'context' in request)
  ) {
    return {};
  }
  const { chatMessage, context } = request as Record<string, unknown>;
  return { chatMessage: asChatMessage(chatMessage), context: asContext(context) };
};

export const useSupportDrawerStore = create<SupportDrawerState>()(set => ({
  isOpen: false,
  chatMessage: undefined,
  context: undefined,
  open: request => set({ isOpen: true, ...asRequest(request) }),
  close: () => set({ isOpen: false, chatMessage: undefined, context: undefined }),
}));

export const openSupportDrawer = (request?: string | SupportDrawerRequest) => {
  useSupportDrawerStore.getState().open(request);
};

export const closeSupportDrawer = () => {
  useSupportDrawerStore.getState().close();
};
