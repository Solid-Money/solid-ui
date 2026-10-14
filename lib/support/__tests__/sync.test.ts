/// <reference types="jest" />

import * as api from '@/lib/api/support';
import {
  attachmentUrl,
  discardMessage,
  linkExpiry,
  loadOlder,
  loadThread,
  markRead,
  resetSyncState,
  retryMessage,
  sendMessage,
  syncThread,
} from '@/lib/support/sync';
import { useSupportChatStore } from '@/store/useSupportChatStore';

import { message, thread } from './fixtures';

jest.mock('@/lib/mmvkStorage', () => () => ({
  getItem: () => null,
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
});

// The real client pulls in the whole app API module; these tests are about the sync logic.
jest.mock('@/lib/api/support', () => {
  class SupportApiError extends Error {
    status: number;
    constructor(code: number, text: string) {
      super(text);
      this.status = code;
    }
  }
  return {
    SupportApiError,
    getSupportThread: jest.fn(),
    getSupportMessages: jest.fn(),
    sendSupportMessage: jest.fn(),
    markSupportRead: jest.fn(),
    rateSupportCase: jest.fn(),
    uploadSupportFile: jest.fn(),
  };
});

const mocked = api as jest.Mocked<typeof api>;
const state = () => useSupportChatStore.getState();
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('support sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSyncState();
    state().reset();
  });

  describe('loading', () => {
    it('returns no attachment URL after the account resets during a link refresh', async () => {
      let finish!: (value: { messages: ReturnType<typeof message>[]; hasOlder: boolean }) => void;
      const old = message({
        attachments: [
          {
            key: 'private-file',
            fileName: 'Statement.pdf',
            width: null,
            height: null,
            blurhash: null,
            mime: 'application/pdf',
            size: 100,
            url: 'https://files.test/a?exp=1',
            status: 'clean',
          },
        ],
      });
      mocked.getSupportMessages.mockReturnValue(new Promise(resolve => (finish = resolve)));
      const pending = attachmentUrl(old, 'private-file');
      resetSyncState();
      state().reset();
      finish({
        messages: [
          message({
            id: old.id,
            attachments: [{ ...old.attachments[0], url: 'https://files.test/fresh' }],
          }),
        ],
        hasOlder: false,
      });
      await expect(pending).resolves.toBeNull();
      expect(state().messages).toHaveLength(0);
    });
    it('shares one request between callers', async () => {
      mocked.getSupportThread.mockResolvedValue(thread({ messages: [message()] }));
      await Promise.all([loadThread(), loadThread()]);
      expect(mocked.getSupportThread).toHaveBeenCalledTimes(1);
      expect(state().loaded).toBe(true);
    });

    it('drops a response that arrives after the account changed', async () => {
      let resolve!: (value: ReturnType<typeof thread>) => void;
      mocked.getSupportThread.mockReturnValue(new Promise(done => (resolve = done)));
      const run = loadThread();
      resetSyncState();
      state().reset();
      resolve(thread({ messages: [message()] }));
      await run;
      expect(state().loaded).toBe(false);
    });

    it('fills the gap between what was held and the newest page after a reconnect', async () => {
      state().setThread(thread({ messages: [message({ seq: 10 })] }));
      mocked.getSupportThread.mockResolvedValue(thread({ messages: [message({ seq: 300 })] }));
      mocked.getSupportMessages
        .mockResolvedValueOnce({
          messages: Array.from({ length: 100 }, (_, index) => message({ seq: 11 + index })),
          hasOlder: false,
        })
        .mockResolvedValueOnce({ messages: [message({ seq: 120 })], hasOlder: false });

      await syncThread();

      expect(mocked.getSupportMessages).toHaveBeenNthCalledWith(1, { afterSeq: 10, limit: 100 });
      expect(mocked.getSupportMessages).toHaveBeenNthCalledWith(2, { afterSeq: 110, limit: 100 });
      expect(state().messages).toHaveLength(103);
    });

    it('remembers a gap it could not finish, and fills it on the next catch-up', async () => {
      state().setThread(thread({ messages: [message({ seq: 10 })] }));
      mocked.getSupportThread.mockResolvedValue(thread({ messages: [message({ seq: 1000 })] }));
      const fullPage = (after: number) => ({
        messages: Array.from({ length: 100 }, (_, index) => message({ seq: after + 1 + index })),
        hasOlder: true,
      });
      for (let page = 0; page < 5; page++) {
        mocked.getSupportMessages.mockResolvedValueOnce(fullPage(10 + page * 100));
      }
      await syncThread();
      expect(mocked.getSupportMessages).toHaveBeenCalledTimes(5);

      // Next catch-up: the newest page has not moved; the gap continues from seq 510.
      mocked.getSupportMessages.mockClear();
      mocked.getSupportMessages.mockResolvedValueOnce({
        messages: [message({ seq: 511 })],
        hasOlder: true,
      });
      await syncThread();
      expect(mocked.getSupportMessages).toHaveBeenCalledWith({ afterSeq: 510, limit: 100 });

      // Closed: nothing more is asked for.
      mocked.getSupportMessages.mockClear();
      await syncThread();
      expect(mocked.getSupportMessages).not.toHaveBeenCalled();
    });

    it('fills an open gap from its top when the user scrolls up', async () => {
      state().setThread(thread({ messages: [message({ seq: 10 })], hasOlder: true }));
      mocked.getSupportThread.mockResolvedValue(thread({ messages: [message({ seq: 1000 })] }));
      for (let page = 0; page < 5; page++) {
        mocked.getSupportMessages.mockResolvedValueOnce({
          messages: Array.from({ length: 100 }, (_, index) =>
            message({ seq: 11 + page * 100 + index }),
          ),
          hasOlder: true,
        });
      }
      await syncThread();
      mocked.getSupportMessages.mockClear();

      mocked.getSupportMessages.mockResolvedValueOnce({
        messages: Array.from({ length: 100 }, (_, index) => message({ seq: 900 + index })),
        hasOlder: true,
      });
      await loadOlder();
      expect(mocked.getSupportMessages).toHaveBeenCalledWith({ beforeSeq: 1000, limit: 100 });
      // hasOlder is about history before the oldest message, untouched by gap filling.
      expect(state().hasOlder).toBe(true);
    });

    it('lets a load for the new account keep its slot when the old one settles', async () => {
      let resolveOld!: (value: ReturnType<typeof thread>) => void;
      mocked.getSupportThread.mockReturnValueOnce(new Promise(done => (resolveOld = done)));
      const old = loadThread();
      resetSyncState();
      state().reset();
      let resolveNew!: (value: ReturnType<typeof thread>) => void;
      mocked.getSupportThread.mockReturnValueOnce(new Promise(done => (resolveNew = done)));
      const current = loadThread();
      resolveOld(thread());
      await old;
      // Still the new account's request: a second caller shares it instead of starting another.
      expect(loadThread()).toBe(current);
      expect(mocked.getSupportThread).toHaveBeenCalledTimes(2);
      resolveNew(thread({ messages: [message()] }));
      await current;
      expect(state().loaded).toBe(true);
    });

    it('asks for nothing more when the newest page joins what was held', async () => {
      state().setThread(thread({ messages: [message({ seq: 10 })] }));
      mocked.getSupportThread.mockResolvedValue(thread({ messages: [message({ seq: 11 })] }));
      await syncThread();
      expect(mocked.getSupportMessages).not.toHaveBeenCalled();
    });

    it('loads older history from the lowest seq held', async () => {
      state().setThread(thread({ messages: [message({ seq: 40 })], hasOlder: true }));
      mocked.getSupportMessages.mockResolvedValue({
        messages: [message({ seq: 20, createdAt: '2020-01-01T00:00:00.000Z' })],
        hasOlder: false,
      });
      await loadOlder();
      expect(mocked.getSupportMessages).toHaveBeenCalledWith({ beforeSeq: 40 });
      expect(state().messages[0].seq).toBe(20);
      expect(state().hasOlder).toBe(false);
    });
  });

  describe('sending', () => {
    it('shows the message at once, then swaps in the stored one', async () => {
      let resolve!: (value: Awaited<ReturnType<typeof api.sendSupportMessage>>) => void;
      mocked.sendSupportMessage.mockReturnValue(new Promise(done => (resolve = done)));

      const id = sendMessage({
        body: '  Where is my deposit?  ',
        context: { kind: 'deposit', id: 'dep1' },
      });
      expect(state().pending).toMatchObject([
        { clientMessageId: id, body: 'Where is my deposit?', status: 'sending' },
      ]);
      expect(mocked.sendSupportMessage).toHaveBeenCalledWith({
        clientMessageId: id,
        body: 'Where is my deposit?',
        uploadIds: [],
        context: { kind: 'deposit', id: 'dep1' },
      });

      resolve({
        message: message({ clientMessageId: id, author: { type: 'user', name: null } }),
        case: { id: 'case9', number: 9, status: 'ai_handling', awaitingRating: false },
      });
      await flush();

      expect(state().pending).toHaveLength(0);
      expect(state().messages).toHaveLength(1);
      expect(state().currentCase?.id).toBe('case9');
    });

    it('marks a failed send and retries with the same id, without re-uploading', async () => {
      mocked.uploadSupportFile.mockResolvedValue({ id: 'up1' } as never);
      mocked.sendSupportMessage
        .mockRejectedValueOnce(new api.SupportApiError(0, 'You appear to be offline'))
        .mockResolvedValueOnce({
          message: message({ author: { type: 'user', name: null } }),
          case: null,
        });

      const id = sendMessage({
        body: '',
        files: [{ uri: 'file:///a.jpg', name: 'a.jpg', mime: 'image/jpeg' }],
      });
      await flush();
      expect(state().pending[0]).toMatchObject({
        status: 'failed',
        error: 'You appear to be offline',
        uploadIds: ['up1'],
      });

      retryMessage(id);
      await flush();

      expect(mocked.uploadSupportFile).toHaveBeenCalledTimes(1);
      expect(mocked.sendSupportMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ clientMessageId: id, uploadIds: ['up1'] }),
      );
    });

    it('explains a rate limit in words', async () => {
      mocked.sendSupportMessage.mockRejectedValue(
        new api.SupportApiError(429, 'Too Many Requests'),
      );
      sendMessage({ body: 'hi' });
      await flush();
      expect(state().pending[0].error).toMatch(/too fast/);
    });

    it('forgets a discarded message, even if its request comes back later', async () => {
      let reject!: (error: unknown) => void;
      mocked.sendSupportMessage.mockReturnValue(new Promise((_, fail) => (reject = fail)));
      const id = sendMessage({ body: 'hi' });
      discardMessage(id);
      reject(new Error('late'));
      await flush();
      expect(state().pending).toHaveLength(0);
    });
  });

  describe('reading', () => {
    it('marks read up to the newest seq held, and only when there is something to mark', async () => {
      state().setThread(thread({ messages: [message({ seq: 5 })], lastReadSeq: 0, unread: 1 }));
      mocked.markSupportRead.mockResolvedValue({ lastReadSeq: 5, unread: 0 });

      await markRead();
      expect(mocked.markSupportRead).toHaveBeenCalledWith(5);
      expect(state()).toMatchObject({ lastReadSeq: 5, unread: 0 });

      await markRead();
      expect(mocked.markSupportRead).toHaveBeenCalledTimes(1);
    });
  });

  describe('file links', () => {
    const fileMessage = (url: string) =>
      message({
        attachments: [
          {
            key: 'k1',
            mime: 'application/pdf',
            size: 10,
            fileName: 'a.pdf',
            width: null,
            height: null,
            blurhash: null,
            status: 'clean',
            url,
          },
        ],
      });

    it('reads the expiry from a signed link', () => {
      expect(linkExpiry('https://x/support/v1/files?key=a&exp=1700000000&sig=b')).toBe(1700000000);
      expect(linkExpiry('https://x/file.pdf')).toBeNull();
    });

    it('uses a link with time left as is', async () => {
      const exp = Math.floor(Date.now() / 1000) + 200;
      const url = `https://x/files?key=k1&exp=${exp}&sig=s`;
      await expect(attachmentUrl(fileMessage(url), 'k1')).resolves.toBe(url);
      expect(mocked.getSupportMessages).not.toHaveBeenCalled();
    });

    it('fetches a fresh link when the held one is about to expire', async () => {
      const exp = Math.floor(Date.now() / 1000) + 5;
      const held = fileMessage(`https://x/files?key=k1&exp=${exp}&sig=s`);
      const freshUrl = `https://x/files?key=k1&exp=${exp + 300}&sig=t`;
      mocked.getSupportMessages.mockResolvedValue({
        messages: [{ ...held, attachments: [{ ...held.attachments[0], url: freshUrl }] }],
        hasOlder: false,
      });

      await expect(attachmentUrl(held, 'k1')).resolves.toBe(freshUrl);
      expect(mocked.getSupportMessages).toHaveBeenCalledWith({ afterSeq: held.seq - 1, limit: 1 });
    });
  });
});
