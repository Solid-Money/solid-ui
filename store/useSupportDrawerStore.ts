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
  /** Set on the Intercom contact before the message opens (the failure sheet's error reference). */
  intercomAttributes?: Record<string, string>;
}

interface SupportDrawerState {
  isOpen: boolean;
  chatMessage?: string;
  context?: SupportDraftContext;
  intercomAttributes?: Record<string, string>;
  /**
   * The request a "contact support" button sent to the in-house chat screen
   * before the app knew whether this user has it. If the answer turns out to be
   * no, the screen reopens the drawer with it, so Intercom still gets the draft.
   */
  pending?: SupportDrawerRequest;
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

/** Plain string values only: anything else is not something Intercom should get. */
const asIntercomAttributes = (attributes?: unknown): Record<string, string> | undefined => {
  if (typeof attributes !== 'object' || attributes === null || Array.isArray(attributes)) {
    return undefined;
  }
  const entries = Object.entries(attributes).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
};

const asRequest = (request?: unknown): SupportDrawerRequest => {
  if (typeof request === 'string') return { chatMessage: asChatMessage(request) };
  if (
    typeof request !== 'object' ||
    request === null ||
    !('chatMessage' in request || 'context' in request || 'intercomAttributes' in request)
  ) {
    return {};
  }
  const { chatMessage, context, intercomAttributes } = request as Record<string, unknown>;
  return {
    chatMessage: asChatMessage(chatMessage),
    context: asContext(context),
    intercomAttributes: asIntercomAttributes(intercomAttributes),
  };
};

export const useSupportDrawerStore = create<SupportDrawerState>()(set => ({
  isOpen: false,
  chatMessage: undefined,
  context: undefined,
  intercomAttributes: undefined,
  pending: undefined,
  open: request => {
    // Every field, so nothing from an earlier request rides along on this one.
    const { chatMessage, context, intercomAttributes } = asRequest(request);
    set({ isOpen: true, chatMessage, context, intercomAttributes });
  },
  close: () =>
    set({
      isOpen: false,
      chatMessage: undefined,
      context: undefined,
      intercomAttributes: undefined,
    }),
}));

/** Keep a request for the support screen to hand back if the chat turns out to be off. */
export const holdSupportRequest = (request: SupportDrawerRequest) => {
  useSupportDrawerStore.setState({ pending: asRequest(request) });
};

/** The held request, once: reading it clears it. */
export const takeHeldSupportRequest = (): SupportDrawerRequest | undefined => {
  const { pending } = useSupportDrawerStore.getState();
  useSupportDrawerStore.setState({ pending: undefined });
  return pending;
};

export const openSupportDrawer = (request?: string | SupportDrawerRequest) => {
  useSupportDrawerStore.getState().open(request);
};

export const closeSupportDrawer = () => {
  useSupportDrawerStore.getState().close();
};
