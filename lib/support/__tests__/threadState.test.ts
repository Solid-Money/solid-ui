/// <reference types="jest" />

import {
  containsCardNumber,
  contextLabel,
  countUnread,
  highestSeq,
  isFreshCase,
  lowestSeq,
  mergeMessages,
  PendingMessage,
  settlePending,
} from '@/lib/support/threadState';

import { message } from './fixtures';

const pending = (clientMessageId: string): PendingMessage => ({
  clientMessageId,
  body: 'hi',
  uploadIds: [],
  attachmentNames: [],
  context: null,
  createdAt: new Date().toISOString(),
  status: 'sending',
});

describe('threadState', () => {
  it('merges without duplicates, the incoming copy winning, in time order', () => {
    const a = message({ createdAt: '2026-10-01T10:00:00.000Z' });
    const b = message({ createdAt: '2026-10-01T09:00:00.000Z' });
    const redactedA = { ...a, body: null, redacted: true };

    const merged = mergeMessages([a], [b, redactedA]);

    expect(merged.map(item => item.id)).toEqual([b.id, a.id]);
    expect(merged[1].redacted).toBe(true);
  });

  it('orders by time even when seq disagrees (imported history keeps its dates)', () => {
    const imported = message({ seq: 900, createdAt: '2025-01-01T00:00:00.000Z' });
    const recent = message({ seq: 10, createdAt: '2026-10-01T00:00:00.000Z' });
    expect(mergeMessages([], [recent, imported]).map(item => item.id)).toEqual([
      imported.id,
      recent.id,
    ]);
  });

  it('returns the same array when nothing arrives', () => {
    const held = [message()];
    expect(mergeMessages(held, [])).toBe(held);
  });

  it('gives the cursors for gap fill and older history', () => {
    const items = [message({ seq: 4 }), message({ seq: 9 }), message({ seq: 6 })];
    expect(highestSeq(items)).toBe(9);
    expect(lowestSeq(items)).toBe(4);
    expect(highestSeq([])).toBe(0);
    expect(lowestSeq([])).toBeNull();
  });

  it('counts only replies after the last read seq', () => {
    const items = [
      message({ seq: 1, author: { type: 'ai', name: 'Solid AI' } }),
      message({ seq: 2, author: { type: 'user', name: null } }),
      message({ seq: 3, author: { type: 'agent', name: 'Dana' } }),
      message({ seq: 4, author: { type: 'system', name: null } }),
    ];
    expect(countUnread(items, 1)).toBe(2);
    expect(countUnread(items, 4)).toBe(0);
  });

  it('drops pending sends the server confirmed', () => {
    const confirmed = message({
      clientMessageId: 'abc12345',
      author: { type: 'user', name: null },
    });
    expect(
      settlePending([pending('abc12345'), pending('zzz12345')], [confirmed]).map(
        p => p.clientMessageId,
      ),
    ).toEqual(['zzz12345']);
  });

  it('knows a case with no messages yet is fresh', () => {
    expect(isFreshCase([message({ caseId: 'old' })], 'new')).toBe(true);
    expect(isFreshCase([message({ caseId: 'new' })], 'new')).toBe(false);
    expect(isFreshCase([], null)).toBe(true);
  });

  it('spots a full card number, spaced or not, and ignores other long numbers', () => {
    expect(containsCardNumber('my card is 4242 4242 4242 4242 thanks')).toBe(true);
    expect(containsCardNumber('4111-1111-1111-1111')).toBe(true);
    expect(containsCardNumber('order 1234567890123')).toBe(false); // fails Luhn
    expect(containsCardNumber('last four 4242')).toBe(false);
    expect(containsCardNumber('')).toBe(false);
  });

  it('names contexts in words', () => {
    expect(contextLabel('card_transaction')).toBe('Card transaction');
    expect(contextLabel('something_new')).toBe('Your account');
  });
});
