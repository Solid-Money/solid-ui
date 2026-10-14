import { create } from 'zustand';

import {
  countUnread,
  mergeMessages,
  PendingMessage,
  settlePending,
} from '@/lib/support/threadState';

import type {
  SupportCase,
  SupportContextRef,
  SupportMessage,
  SupportThread,
} from '@/lib/types/support';

/** A context card waiting above the composer (removable, sent with the first message). */
export interface SupportDraftContext extends SupportContextRef {
  /** Display only, e.g. "Card payment · Starbucks · $4.50". Never sent: the server loads the object. */
  label?: string;
}

interface SupportChatState {
  conversationId: string | null;
  messages: SupportMessage[];
  pending: PendingMessage[];
  currentCase: SupportCase | null;
  hasOlder: boolean;
  lastReadSeq: number;
  unread: number;
  aiTyping: boolean;
  /** What Solid AI is looking up right now (`deposits`, `balances`, …), if the server said. */
  aiActivity: string | null;
  ai: SupportThread['ai'] | null;
  incidents: SupportThread['incidents'];
  loaded: boolean;
  /** Bumped when the local copy may have missed something (the realtime socket reconnected): the chat gap-fills. */
  syncEpoch: number;
  draftContext: SupportDraftContext | null;

  setThread: (thread: SupportThread) => void;
  receive: (messages: SupportMessage[]) => void;
  prependOlder: (messages: SupportMessage[], hasOlder: boolean) => void;
  addPending: (entry: PendingMessage) => void;
  failPending: (clientMessageId: string, error: string) => void;
  retryPending: (clientMessageId: string) => void;
  dropPending: (clientMessageId: string) => void;
  setCase: (supportCase: SupportCase | null) => void;
  setRead: (lastReadSeq: number, unread?: number) => void;
  setTyping: (typing: boolean, activity?: string | null) => void;
  bumpSync: () => void;
  setDraftContext: (context: SupportDraftContext | null) => void;
  reset: () => void;
}

const initial = {
  conversationId: null,
  messages: [] as SupportMessage[],
  pending: [] as PendingMessage[],
  currentCase: null,
  hasOlder: false,
  lastReadSeq: 0,
  unread: 0,
  aiTyping: false,
  aiActivity: null as string | null,
  ai: null,
  incidents: [] as SupportThread['incidents'],
  loaded: false,
  syncEpoch: 0,
  draftContext: null,
};

/**
 * The support chat's local copy of the thread, shared by the chat screen, the
 * header badge and the realtime client. Kept in memory only: the chat holds
 * account details, so nothing is written to the device until the encrypted
 * cache ships with the next native build.
 */
export const useSupportChatStore = create<SupportChatState>()(set => ({
  ...initial,

  setThread: thread =>
    set(state => {
      const messages = mergeMessages(state.messages, thread.messages);
      return {
        conversationId: thread.conversationId,
        messages,
        pending: settlePending(state.pending, thread.messages),
        currentCase: thread.currentCase,
        hasOlder: state.loaded ? state.hasOlder || thread.hasOlder : thread.hasOlder,
        lastReadSeq: Math.max(state.lastReadSeq, thread.lastReadSeq),
        // The server counts past the first page; messages that arrived live since are counted here.
        unread: Math.max(
          thread.unread,
          countUnread(messages, Math.max(state.lastReadSeq, thread.lastReadSeq)),
        ),
        ai: thread.ai,
        incidents: thread.incidents,
        loaded: true,
      };
    }),

  receive: incoming =>
    set(state => {
      const fresh = incoming.filter(
        message => !state.messages.some(held => held.id === message.id),
      );
      const messages = mergeMessages(state.messages, incoming);
      const replied = incoming.some(message => message.author.type === 'ai');
      return {
        messages,
        pending: settlePending(state.pending, incoming),
        // The held history can be incomplete (the server counts past the first
        // page), so the count is carried forward: only replies new to this copy
        // and after the read marker add to it. An update to a held message
        // (fresh file links, a redaction) changes nothing.
        unread: state.unread + countUnread(fresh, state.lastReadSeq),
        // An AI message ends the AI's turn, whatever the typing event said.
        aiTyping: replied ? false : state.aiTyping,
        aiActivity: replied ? null : state.aiActivity,
      };
    }),

  prependOlder: (older, hasOlder) =>
    set(state => ({ messages: mergeMessages(state.messages, older), hasOlder })),

  addPending: entry => set(state => ({ pending: [...state.pending, entry] })),

  failPending: (clientMessageId, error) =>
    set(state => ({
      pending: state.pending.map(entry =>
        entry.clientMessageId === clientMessageId ? { ...entry, status: 'failed', error } : entry,
      ),
    })),

  retryPending: clientMessageId =>
    set(state => ({
      pending: state.pending.map(entry =>
        entry.clientMessageId === clientMessageId
          ? { ...entry, status: 'sending', error: undefined }
          : entry,
      ),
    })),

  dropPending: clientMessageId =>
    set(state => ({
      pending: state.pending.filter(entry => entry.clientMessageId !== clientMessageId),
    })),

  setCase: currentCase => set({ currentCase }),

  setRead: (lastReadSeq, unread) =>
    set(state => {
      const read = Math.max(state.lastReadSeq, lastReadSeq);
      return { lastReadSeq: read, unread: unread ?? countUnread(state.messages, read) };
    }),

  setTyping: (aiTyping, activity) =>
    set(state => ({
      aiTyping,
      // A plain "still typing" keeps the last activity; stopping clears it.
      aiActivity: aiTyping ? (activity ?? state.aiActivity) : null,
    })),

  bumpSync: () => set(state => ({ syncEpoch: state.syncEpoch + 1 })),

  setDraftContext: draftContext => set({ draftContext }),

  reset: () => set({ ...initial }),
}));
