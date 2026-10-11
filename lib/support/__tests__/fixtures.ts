import type { SupportMessage, SupportThread } from '@/lib/types/support';

let counter = 0;

export const message = (overrides: Partial<SupportMessage> = {}): SupportMessage => {
  counter += 1;
  return {
    id: `m${counter}`,
    seq: counter,
    clientMessageId: null,
    caseId: 'case1',
    author: { type: 'ai', name: 'Solid AI' },
    body: `body ${counter}`,
    attachments: [],
    context: null,
    redacted: false,
    createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, counter)).toISOString(),
    ...overrides,
  };
};

export const thread = (overrides: Partial<SupportThread> = {}): SupportThread => ({
  conversationId: 'conv1',
  currentCase: { id: 'case1', number: 7, status: 'ai_handling', awaitingRating: false },
  messages: [],
  hasOlder: false,
  lastReadSeq: 0,
  unread: 0,
  ai: { enabled: true, expectedReplyText: null },
  incidents: [],
  ...overrides,
});
