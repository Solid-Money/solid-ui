import * as Sentry from '@sentry/react-native';

import { resetSyncState } from '@/lib/support/sync';
import { useSupportChatStore } from '@/store/useSupportChatStore';

import type { SupportCase, SupportMessage } from '@/lib/types/support';

/**
 * The support chat's events on the app's one realtime socket. accounts-service
 * forwards them from the user's own channel, so they only ever concern the
 * signed-in user's thread. Each one is checked before it touches the store: a
 * malformed event is reported and dropped, never half-applied.
 */
export const SUPPORT_SOCKET_EVENTS = [
  'support_message',
  'support_message_updated',
  'support_typing',
  'support_case_updated',
  'support_read',
] as const;

export type SupportSocketEvent = (typeof SUPPORT_SOCKET_EVENTS)[number];

/** The AI's typing dots clear on their own if the "stopped" event never comes. */
export const TYPING_TIMEOUT_MS = 45_000;

let typingTimer: ReturnType<typeof setTimeout> | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isMessage = (value: unknown): value is SupportMessage =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.seq === 'number' &&
  typeof value.createdAt === 'string' &&
  isRecord(value.author) &&
  typeof value.author.type === 'string' &&
  Array.isArray(value.attachments);

const isCase = (value: unknown): value is SupportCase =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.number === 'number' &&
  typeof value.status === 'string';

/** Another thread than the one loaded (can only happen around an account switch). */
const otherThread = (data: Record<string, unknown>) => {
  const loaded = useSupportChatStore.getState().conversationId;
  return (
    typeof data.conversationId === 'string' && loaded !== null && data.conversationId !== loaded
  );
};

const malformed = (event: SupportSocketEvent) =>
  Sentry.captureMessage('Malformed realtime support event', {
    level: 'warning',
    tags: { type: 'realtime_malformed_support_event', event },
  });

const setTyping = (typing: boolean, activity: string | null = null) => {
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = null;
  useSupportChatStore.getState().setTyping(typing, activity);
  if (typing) {
    typingTimer = setTimeout(() => {
      typingTimer = null;
      useSupportChatStore.getState().setTyping(false);
    }, TYPING_TIMEOUT_MS);
  }
};

export function handleSupportEvent(event: SupportSocketEvent, data: unknown): void {
  if (!isRecord(data)) {
    malformed(event);
    return;
  }
  const store = useSupportChatStore.getState();

  switch (event) {
    case 'support_message':
    case 'support_message_updated': {
      if (!isMessage(data.message)) {
        malformed(event);
        return;
      }
      store.receive([data.message]);
      if (data.message.author.type === 'ai') setTyping(false);
      return;
    }
    case 'support_typing': {
      if (typeof data.typing !== 'boolean') {
        malformed(event);
        return;
      }
      if (otherThread(data)) return;
      setTyping(data.typing, typeof data.activity === 'string' ? data.activity : null);
      return;
    }
    case 'support_case_updated': {
      if (data.case !== null && !isCase(data.case)) {
        malformed(event);
        return;
      }
      if (otherThread(data)) return;
      store.setCase(data.case as SupportCase | null);
      return;
    }
    case 'support_read': {
      if (typeof data.lastReadSeq !== 'number') {
        malformed(event);
        return;
      }
      if (otherThread(data)) return;
      store.setRead(data.lastReadSeq, typeof data.unread === 'number' ? data.unread : undefined);
      return;
    }
  }
}

/** Forget everything about the thread: a sign-out or account switch. */
export function resetSupportChat(): void {
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = null;
  resetSyncState();
  useSupportChatStore.getState().reset();
}
