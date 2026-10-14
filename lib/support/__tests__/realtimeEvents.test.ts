/// <reference types="jest" />

import * as Sentry from '@sentry/react-native';

import {
  handleSupportEvent,
  resetSupportChat,
  TYPING_TIMEOUT_MS,
} from '@/lib/support/realtimeEvents';
import { useSupportChatStore } from '@/store/useSupportChatStore';

import { message, thread } from './fixtures';

jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn() }));
jest.mock('@/lib/support/sync', () => ({ resetSyncState: jest.fn() }));

const state = () => useSupportChatStore.getState();

describe('support realtime events', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetSupportChat();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it('adds a new reply', () => {
    handleSupportEvent('support_message', { conversationId: 'conv1', message: message() });
    expect(state().messages).toHaveLength(1);
    expect(state().unread).toBe(1);
  });

  it('replaces a message that changed (redacted)', () => {
    const original = message();
    handleSupportEvent('support_message', { message: original });
    handleSupportEvent('support_message_updated', {
      message: { ...original, body: null, redacted: true },
    });
    expect(state().messages).toEqual([
      expect.objectContaining({ id: original.id, redacted: true }),
    ]);
  });

  it('reports and drops a malformed event', () => {
    handleSupportEvent('support_message', { message: { id: 1 } });
    handleSupportEvent('support_read', 'nope');
    expect(state().messages).toHaveLength(0);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(2);
  });

  it('shows the typing dots, and clears them if the stop never comes', () => {
    handleSupportEvent('support_typing', { conversationId: 'conv1', typing: true });
    expect(state().aiTyping).toBe(true);
    jest.advanceTimersByTime(TYPING_TIMEOUT_MS);
    expect(state().aiTyping).toBe(false);
  });

  it('says what Solid AI is looking up, and forgets it when it stops', () => {
    handleSupportEvent('support_typing', {
      conversationId: 'conv1',
      typing: true,
      activity: 'deposits',
    });
    expect(state().aiActivity).toBe('deposits');
    handleSupportEvent('support_typing', { conversationId: 'conv1', typing: false });
    expect(state().aiActivity).toBeNull();
  });

  it('ignores events for a thread other than the one loaded', () => {
    state().setThread(thread({ conversationId: 'conv1' }));
    handleSupportEvent('support_typing', { conversationId: 'other', typing: true });
    handleSupportEvent('support_case_updated', { conversationId: 'other', case: null });
    expect(state().aiTyping).toBe(false);
    expect(state().currentCase).not.toBeNull();
  });

  it('applies a case change and a read on another device', () => {
    state().setThread(thread({ messages: [message({ seq: 3 })], unread: 1 }));
    handleSupportEvent('support_case_updated', {
      conversationId: 'conv1',
      case: { id: 'case1', number: 7, status: 'resolved', awaitingRating: true },
    });
    handleSupportEvent('support_read', { conversationId: 'conv1', lastReadSeq: 3, unread: 0 });
    expect(state().currentCase).toMatchObject({ status: 'resolved', awaitingRating: true });
    expect(state()).toMatchObject({ lastReadSeq: 3, unread: 0 });
  });

  it('forgets the thread on reset', () => {
    state().setThread(thread({ messages: [message()] }));
    resetSupportChat();
    expect(state().loaded).toBe(false);
    expect(state().messages).toHaveLength(0);
  });
});
