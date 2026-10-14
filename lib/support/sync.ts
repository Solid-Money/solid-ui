import * as Crypto from 'expo-crypto';

import { captureAccountScope } from '@/lib/accountScope';
import {
  getSupportMessages,
  getSupportThread,
  markSupportRead,
  rateSupportCase,
  sendSupportMessage,
  SupportApiError,
  uploadSupportFile,
} from '@/lib/api/support';
import { highestSeq, lowestSeq } from '@/lib/support/threadState';
import { useSupportChatStore } from '@/store/useSupportChatStore';

import type { SupportContextRef, SupportFile, SupportMessage } from '@/lib/types/support';

/**
 * Everything the support chat does against the server, outside React so the
 * chat screen, the header badge and the realtime client share one copy of the
 * thread and one request of each kind at a time.
 */

/** Gap-fill page size (the server allows up to 200). */
const SYNC_PAGE = 100;
/**
 * A catch-up never pages through more than this at once. What is left stays
 * in `gap` and is filled by the next catch-up, or first by scrolling up.
 */
const SYNC_MAX_PAGES = 5;

export const MAX_BODY_LENGTH = 10_000;
export const MAX_ATTACHMENTS = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/heic',
  'application/pdf',
];

/** Bumped when the account changes: a request started for the previous account writes nothing. */
let generation = 0;
let loading: Promise<void> | null = null;
let syncing: Promise<void> | null = null;
let loadingOlder: Promise<void> | null = null;
let reading: Promise<void> | null = null;
/**
 * Messages missing between what was held and the newest page: everything
 * after `after` and before `until`. Filled from the bottom by `syncThread`
 * and from the top by `loadOlder`, so it closes whichever way the user goes.
 */
let gap: { after: number; until: number } | null = null;

/** Files waiting to upload, kept for a retry (Blobs do not belong in the store). */
const pendingFiles = new Map<string, SupportFile[]>();

const store = () => useSupportChatStore.getState();

/** Runs `write` only if the account has not changed since `started`. */
const ifCurrent =
  <T>(started: number, write: (value: T) => void) =>
  (value: T) => {
    if (started === generation) write(value);
  };

/** Load the thread once; later calls share the request. */
export function loadThread(): Promise<void> {
  if (!loading) {
    // A request from before an account switch must not clear the new account's slot.
    const run: Promise<void> = getSupportThread()
      .then(ifCurrent(generation, thread => store().setThread(thread)))
      .finally(() => {
        if (loading === run) loading = null;
      });
    loading = run;
  }
  return loading;
}

/** Fill `gap` upwards from its bottom, a few pages at a time. */
async function fillGap(started: number): Promise<void> {
  for (let page = 0; gap && page < SYNC_MAX_PAGES; page++) {
    const { after, until } = gap;
    const { messages } = await getSupportMessages({ afterSeq: after, limit: SYNC_PAGE });
    if (started !== generation) return;
    store().receive(messages);
    const top = highestSeq(messages);
    // Closed: a short page, the newest page reached, or no progress (never loop on it).
    if (messages.length < SYNC_PAGE || top >= until - 1 || top <= after) {
      gap = null;
      return;
    }
    gap = { after: top, until };
  }
}

/**
 * Catch up after the socket came back, or the app came back to the front:
 * the thread's newest page (case, unread, incidents), then anything between
 * what we held and that page.
 */
export function syncThread(): Promise<void> {
  if (!store().loaded) return loadThread();
  if (!syncing) {
    const run: Promise<void> = (async () => {
      const started = generation;
      const heldTop = highestSeq(store().messages);
      const thread = await getSupportThread();
      if (started !== generation) return;
      store().setThread(thread);
      const freshBottom = thread.messages.length ? thread.messages[0].seq : null;
      // Internal notes leave holes in seq, so this can ask once for nothing; it never misses.
      if (heldTop > 0 && freshBottom !== null && freshBottom > heldTop + 1) {
        // A gap still open from an earlier catch-up is folded in: fill from the lower bottom
        // up to the new page (messages already held in between are merged, not duplicated).
        gap = { after: gap ? Math.min(gap.after, heldTop) : heldTop, until: freshBottom };
      }
      if (gap) await fillGap(started);
    })().finally(() => {
      if (syncing === run) syncing = null;
    });
    syncing = run;
  }
  return syncing;
}

/** The page of history before the oldest message held. */
export function loadOlder(): Promise<void> {
  if (loadingOlder) return loadingOlder;
  const started = generation;
  let run: Promise<void>;
  if (gap) {
    // Scrolling up reaches the gap before anything older: fill it from its top.
    const { after, until } = gap;
    run = getSupportMessages({ beforeSeq: until, limit: SYNC_PAGE }).then(page => {
      if (started !== generation) return;
      store().receive(page.messages);
      const bottom = lowestSeq(page.messages);
      gap =
        bottom === null || bottom <= after + 1 || !page.hasOlder || bottom >= until
          ? null
          : { after, until: bottom };
    });
  } else {
    const { hasOlder, messages } = store();
    const before = lowestSeq(messages);
    if (!hasOlder || before === null) return Promise.resolve();
    run = getSupportMessages({ beforeSeq: before }).then(
      ifCurrent(started, page => store().prependOlder(page.messages, page.hasOlder)),
    );
  }
  const owned: Promise<void> = run.finally(() => {
    if (loadingOlder === owned) loadingOlder = null;
  });
  loadingOlder = owned;
  return owned;
}

/** Tell the server the user has seen everything held. Only asks when something is unread. */
export function markRead(): Promise<void> {
  const { messages, lastReadSeq, unread } = store();
  const top = highestSeq(messages);
  if (top <= lastReadSeq && unread === 0) return Promise.resolve();
  if (!reading) {
    const run: Promise<void> = markSupportRead(top)
      .then(ifCurrent(generation, result => store().setRead(result.lastReadSeq, result.unread)))
      .catch(() => undefined) // The next read or focus tries again.
      .finally(() => {
        if (reading === run) reading = null;
      });
    reading = run;
  }
  return reading;
}

export interface SendInput {
  body: string;
  files?: SupportFile[];
  context?: SupportContextRef | null;
}

const describe = (error: unknown) =>
  error instanceof SupportApiError
    ? error.status === 429
      ? 'You are sending messages too fast. Wait a moment and try again.'
      : error.message
    : 'Could not send. Tap to retry.';

/**
 * Send a message: shown at once as pending, files uploaded first, then the
 * message. The id is generated here and reused by every retry, so a message
 * that reached the server before the connection dropped is never stored twice.
 */
export function sendMessage(input: SendInput): string {
  const clientMessageId = Crypto.randomUUID();
  const body = input.body.trim();
  const files = input.files ?? [];
  pendingFiles.set(clientMessageId, files);
  store().addPending({
    clientMessageId,
    body,
    uploadIds: [],
    attachmentNames: files.map(file => file.name),
    context: input.context ? { kind: input.context.kind, id: input.context.id ?? null } : null,
    createdAt: new Date().toISOString(),
    status: 'sending',
  });
  void deliver(clientMessageId);
  return clientMessageId;
}

/** Try a failed message again, with the same id. */
export function retryMessage(clientMessageId: string): void {
  const entry = store().pending.find(candidate => candidate.clientMessageId === clientMessageId);
  if (!entry || entry.status !== 'failed') return;
  store().retryPending(clientMessageId);
  void deliver(clientMessageId);
}

/** Give up on a failed message. */
export function discardMessage(clientMessageId: string): void {
  pendingFiles.delete(clientMessageId);
  store().dropPending(clientMessageId);
}

async function deliver(clientMessageId: string): Promise<void> {
  const started = generation;
  const entry = store().pending.find(candidate => candidate.clientMessageId === clientMessageId);
  if (!entry) return;
  // Discarded, or the account changed, while a request was out.
  const gone = () =>
    started !== generation ||
    !store().pending.some(candidate => candidate.clientMessageId === clientMessageId);
  try {
    // Uploads that already went through are kept, so a retry only sends what is left.
    const files = pendingFiles.get(clientMessageId) ?? [];
    const uploadIds = [...entry.uploadIds];
    for (const file of files.slice(uploadIds.length)) {
      const upload = await uploadSupportFile(file);
      if (gone()) return;
      uploadIds.push(upload.id);
      useSupportChatStore.setState(state => ({
        pending: state.pending.map(candidate =>
          candidate.clientMessageId === clientMessageId
            ? { ...candidate, uploadIds: [...uploadIds] }
            : candidate,
        ),
      }));
    }
    const result = await sendSupportMessage({
      clientMessageId,
      body: entry.body || undefined,
      uploadIds,
      context: entry.context
        ? { kind: entry.context.kind as SupportContextRef['kind'], id: entry.context.id }
        : undefined,
    });
    if (started !== generation) return;
    pendingFiles.delete(clientMessageId);
    store().receive([result.message]);
    if (result.case) store().setCase(result.case);
  } catch (error) {
    if (!gone()) store().failPending(clientMessageId, describe(error));
  }
}

/** Seconds a file link must still have to be used as is. */
const LINK_MARGIN_S = 30;
const linkRefreshes = new Map<string, Promise<SupportMessage | null>>();

/** The `exp` of a signed file link, in seconds; null when it has none. */
export function linkExpiry(url: string): number | null {
  const match = /[?&]exp=(\d+)/.exec(url);
  return match ? Number(match[1]) : null;
}

const linkUsable = (url: string | null, nowS = Date.now() / 1000): url is string => {
  if (!url) return false;
  const exp = linkExpiry(url);
  return exp === null || exp - nowS > LINK_MARGIN_S;
};

/** Re-read one message, for fresh file links (they last five minutes). */
export function refreshMessage(
  message: Pick<SupportMessage, 'id' | 'seq'>,
): Promise<SupportMessage | null> {
  const inFlight = linkRefreshes.get(message.id);
  if (inFlight) return inFlight;
  const started = generation;
  const scope = captureAccountScope();
  const run: Promise<SupportMessage | null> = getSupportMessages({
    afterSeq: message.seq - 1,
    limit: 1,
  })
    .then(({ messages }) => {
      if (started !== generation || !scope.isCurrent()) return null;
      const fresh = messages.find(candidate => candidate.id === message.id) ?? null;
      if (fresh) store().receive([fresh]);
      return fresh;
    })
    .finally(() => {
      // Only this request's own entry: an account switch may have started another.
      if (linkRefreshes.get(message.id) === run) linkRefreshes.delete(message.id);
    });
  linkRefreshes.set(message.id, run);
  return run;
}

/** A usable link for one attachment: the one held if it has time left, else a fresh one. */
export async function attachmentUrl(message: SupportMessage, key: string): Promise<string | null> {
  const held = message.attachments.find(file => file.key === key)?.url ?? null;
  if (linkUsable(held)) return held;
  const fresh = await refreshMessage(message);
  return fresh?.attachments.find(file => file.key === key)?.url ?? null;
}

/** Whether a held link can be opened without asking for a new one (the web opens it in the tap itself). */
export const isLinkFresh = (url: string | null) => linkUsable(url);

/** Rate a resolved case, 1 to 5. */
export async function rateCase(caseId: string, score: number, comment?: string): Promise<void> {
  const started = generation;
  const updated = await rateSupportCase(caseId, score, comment);
  if (started === generation && store().currentCase?.id === updated.id) store().setCase(updated);
}

/** The account changed or signed out: drop in-flight work and queued files. */
export function resetSyncState(): void {
  generation++;
  loading = null;
  syncing = null;
  loadingOlder = null;
  reading = null;
  gap = null;
  pendingFiles.clear();
  linkRefreshes.clear();
}
