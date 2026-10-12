/**
 * The support chat's API shapes, as flash-support-service returns them.
 * Backend: apps/flash-support-service/src/chat in solid-backend.
 */

export type SupportAuthorType = 'user' | 'ai' | 'agent' | 'system';

export type SupportCaseStatus =
  | 'ai_handling'
  | 'needs_human'
  | 'assigned'
  | 'waiting_customer'
  | 'snoozed'
  | 'escalated'
  | 'resolved';

export interface SupportAttachment {
  key: string;
  mime: string;
  size: number;
  fileName: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  status: 'pending' | 'clean' | 'rejected' | 'redacted';
  /** Short-lived link; null until the file is clean, or when redacted. */
  url: string | null;
}

/** What a chat can be opened from. The server loads the object; the app never sends amounts. */
export const SUPPORT_CONTEXT_KINDS = [
  'card_transaction',
  'activity',
  'deposit',
  'withdrawal',
  'kyc',
  'card',
  'virtual_account',
  'rewards',
] as const;

export type SupportContextKind = (typeof SUPPORT_CONTEXT_KINDS)[number];

export interface SupportContextRef {
  kind: SupportContextKind;
  id?: string | null;
}

export interface SupportMessage {
  id: string;
  seq: number;
  clientMessageId: string | null;
  caseId: string | null;
  author: { type: SupportAuthorType; name: string | null };
  body: string | null;
  attachments: SupportAttachment[];
  context: { kind: string; id: string | null } | null;
  redacted: boolean;
  createdAt: string;
}

export interface SupportCase {
  id: string;
  number: number;
  status: SupportCaseStatus;
  /** Resolved and not yet rated: show the 1-tap rating. */
  awaitingRating: boolean;
}

export interface SupportThread {
  conversationId: string;
  currentCase: SupportCase | null;
  messages: SupportMessage[];
  hasOlder: boolean;
  lastReadSeq: number;
  unread: number;
  ai: { enabled: boolean; expectedReplyText: string | null };
  incidents: { title: string; message: string }[];
}

export interface SupportUpload {
  id: string;
  key: string;
  mime: string;
  size: number;
  fileName: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  url: string | null;
}

/** A file the user picked, before upload. */
export interface SupportFile {
  /** Native: a file:// uri. Web: a Blob/File. */
  uri?: string;
  blob?: Blob;
  name: string;
  mime: string;
  size?: number;
}
