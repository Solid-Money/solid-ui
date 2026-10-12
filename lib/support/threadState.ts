import type { SupportMessage } from '@/lib/types/support';

/**
 * Pure helpers for the chat's local copy of the thread. `seq` is the sync
 * cursor (gap fill asks for everything after the highest seq seen); the
 * screen orders by `createdAt`, because imported history and merged threads
 * get fresh seqs but keep their original times. Seqs have holes by design:
 * the team's internal notes share the sequence and never reach the app, so a
 * jump in seq is not a missed message.
 */

const byTimeThenSeq = (a: SupportMessage, b: SupportMessage) => {
  const at = Date.parse(a.createdAt);
  const bt = Date.parse(b.createdAt);
  return at === bt ? a.seq - b.seq : at - bt;
};

/** Existing plus incoming, one copy per id (the incoming one wins), in display order. */
export function mergeMessages(
  existing: SupportMessage[],
  incoming: SupportMessage[],
): SupportMessage[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map(message => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(byTimeThenSeq);
}

/** Highest seq held: the `afterSeq` cursor for a gap fill. */
export function highestSeq(messages: SupportMessage[]): number {
  return messages.reduce((max, message) => Math.max(max, message.seq), 0);
}

/** Lowest seq held: the `beforeSeq` cursor for loading older history. */
export function lowestSeq(messages: SupportMessage[]): number | null {
  return messages.length
    ? messages.reduce((min, message) => Math.min(min, message.seq), Infinity)
    : null;
}

/** Replies (not the user's own messages) after the last read seq. */
export function countUnread(messages: SupportMessage[], lastReadSeq: number): number {
  return messages.filter(message => message.author.type !== 'user' && message.seq > lastReadSeq)
    .length;
}

/** Local messages not yet confirmed: shown at the end, in the order sent. */
export interface PendingMessage {
  clientMessageId: string;
  body: string;
  uploadIds: string[];
  /** Previews of attached files, for the bubble while it sends. */
  attachmentNames: string[];
  context: { kind: string; id?: string | null } | null;
  createdAt: string;
  status: 'sending' | 'failed';
  error?: string;
}

/** Drop pending messages the server has now confirmed (matched by clientMessageId). */
export function settlePending(
  pending: PendingMessage[],
  confirmed: SupportMessage[],
): PendingMessage[] {
  const ids = new Set(confirmed.map(message => message.clientMessageId).filter(Boolean));
  return ids.size ? pending.filter(entry => !ids.has(entry.clientMessageId)) : pending;
}

/** The current case has no messages yet: show the quick replies. */
export function isFreshCase(messages: SupportMessage[], currentCaseId: string | null): boolean {
  if (!currentCaseId) return true;
  return !messages.some(message => message.caseId === currentCaseId);
}

/** Quick replies on a fresh case: today's Intercom menu, which starts 45% of chats. */
export const QUICK_REPLIES = [
  'KYC',
  'Deposit not showing',
  'Card declined',
  'Rewards',
  'Add money',
  'Something else',
] as const;

const luhn = (digits: string) => {
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
};

/**
 * Whether the text holds what looks like a full card number (13 to 19 digits,
 * spaces or dashes allowed, passing the Luhn check). The composer warns before
 * it is sent; the server masks it either way.
 */
export function containsCardNumber(text: string): boolean {
  const runs = text.match(/\d(?:[ -]?\d){12,18}/g) ?? [];
  return runs.some(run => luhn(run.replace(/\D/g, '')));
}

const CONTEXT_LABELS: Record<string, string> = {
  card_transaction: 'Card transaction',
  activity: 'Transaction',
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  kyc: 'Identity verification',
  card: 'Card',
  virtual_account: 'Bank account',
  rewards: 'Rewards',
  help_article: 'Help article',
  error: 'Something that failed',
};

/** What a message was sent from, in words. */
export const contextLabel = (kind: string) => CONTEXT_LABELS[kind] ?? 'Your account';
