/// <reference types="jest" />

import { message, thread } from '@/lib/support/__tests__/fixtures';
import { useSupportChatStore } from '@/store/useSupportChatStore';

const state = () => useSupportChatStore.getState();

describe('useSupportChatStore', () => {
  beforeEach(() => state().reset());

  it('loads the thread and takes the server unread count', () => {
    const replies = [message({ seq: 3 }), message({ seq: 4 })];
    state().setThread(thread({ messages: replies, unread: 12, lastReadSeq: 2 }));

    expect(state()).toMatchObject({
      loaded: true,
      conversationId: 'conv1',
      unread: 12,
      lastReadSeq: 2,
    });
    expect(state().messages).toHaveLength(2);
  });

  it('counts live replies before the thread has loaded, for the header dot', () => {
    state().receive([message({ author: { type: 'agent', name: 'Dana' } })]);
    state().receive([message({ author: { type: 'user', name: null } })]);
    expect(state().unread).toBe(1);
  });

  it('does not count the same live message twice', () => {
    const reply = message();
    state().receive([reply]);
    state().receive([reply]);
    expect(state().unread).toBe(1);
  });

  it('recounts from the messages once loaded', () => {
    state().setThread(thread({ messages: [message({ seq: 1 })], lastReadSeq: 1 }));
    state().receive([
      message({ seq: 5 }),
      message({ seq: 6, author: { type: 'user', name: null } }),
    ]);
    expect(state().unread).toBe(1);
  });

  it('settles a pending send when its message arrives', () => {
    state().addPending({
      clientMessageId: 'client-1',
      body: 'hello',
      uploadIds: [],
      attachmentNames: [],
      context: null,
      createdAt: new Date().toISOString(),
      status: 'sending',
    });
    state().receive([
      message({ clientMessageId: 'client-1', author: { type: 'user', name: null } }),
    ]);
    expect(state().pending).toHaveLength(0);
  });

  it('stops the typing dots when Solid AI answers', () => {
    state().setTyping(true, 'balances');
    state().receive([message({ author: { type: 'ai', name: 'Solid AI' } })]);
    expect(state().aiTyping).toBe(false);
    expect(state().aiActivity).toBeNull();
  });

  it('keeps the last activity while Solid AI is still working', () => {
    state().setTyping(true, 'deposits');
    state().setTyping(true);
    expect(state().aiActivity).toBe('deposits');
    state().setTyping(false);
    expect(state().aiActivity).toBeNull();
  });

  it('never moves the read marker backwards', () => {
    state().setRead(9, 0);
    state().setRead(4);
    expect(state().lastReadSeq).toBe(9);
  });

  it('keeps hasOlder from the first load when a later catch-up returns the newest page', () => {
    state().setThread(thread({ messages: [message()], hasOlder: true }));
    state().prependOlder([message({ createdAt: '2020-01-01T00:00:00.000Z' })], true);
    state().setThread(thread({ messages: [message()], hasOlder: false }));
    expect(state().hasOlder).toBe(true);
  });

  it('bumps the sync epoch', () => {
    const before = state().syncEpoch;
    state().bumpSync();
    expect(state().syncEpoch).toBe(before + 1);
  });
});
