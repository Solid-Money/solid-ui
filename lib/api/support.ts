import { captureAccountScope } from '@/lib/accountScope';
import { getJWTToken, getPlatformHeaders } from '@/lib/api';
import { EXPO_PUBLIC_SUPPORT_API_BASE_URL } from '@/lib/config';
import { withRefreshToken } from '@/lib/utils';

import type {
  SupportCase,
  SupportContextRef,
  SupportFile,
  SupportMessage,
  SupportThread,
  SupportUpload,
} from '@/lib/types/support';

/**
 * The in-house support chat (flash-support-service). Same session as every
 * other call: the Bearer token on native, the `access_token` cookie on web.
 * The server takes the user from the session only; nothing here names a user
 * or a conversation.
 *
 * Backend: apps/flash-support-service/src/chat in solid-backend.
 */

export const isSupportChatConfigured = () => EXPO_PUBLIC_SUPPORT_API_BASE_URL !== '';

const base = () => `${EXPO_PUBLIC_SUPPORT_API_BASE_URL.replace(/\/+$/, '')}/support/v1`;

/** A failed support call. The message is safe to show; it never echoes what was sent. */
export class SupportApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SupportApiError';
  }

  /** Worth retrying later (offline, server trouble, rate limit), as opposed to a refused request. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

const headers = (json: boolean) => {
  const jwt = getJWTToken();
  return {
    Accept: 'application/json',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...getPlatformHeaders(),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base()}${path}`, {
      ...init,
      headers: { ...headers(typeof init.body === 'string'), ...(init.headers ?? {}) },
      credentials: 'include',
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new SupportApiError(0, 'You appear to be offline');
  }
  if (response.status === 401) {
    // withRefreshToken refreshes the session on a 401 response and retries once.
    throw response;
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message : 'Something went wrong';
    throw new SupportApiError(response.status, message);
  }
  return (await response.json()) as T;
}

const call = <T>(path: string, init?: RequestInit) => {
  const scope = captureAccountScope();
  return withRefreshToken(async () => {
    scope.assertCurrent();
    try {
      const result = await request<T>(path, init);
      scope.assertCurrent();
      return result;
    } catch (error) {
      // Do not let a previous account's 401 refresh or retry a later session.
      scope.assertCurrent();
      throw error;
    }
  });
};

/** For the help center client (lib/api/help.ts): same base, session and errors. */
export const supportCall = call;

export const getSupportThread = (signal?: AbortSignal) =>
  call<SupportThread>('/thread', { signal });

export const getSupportMessages = (
  query: { afterSeq?: number; beforeSeq?: number; limit?: number },
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams();
  if (query.afterSeq !== undefined) params.set('afterSeq', String(query.afterSeq));
  if (query.beforeSeq !== undefined) params.set('beforeSeq', String(query.beforeSeq));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  return call<{ messages: SupportMessage[]; hasOlder: boolean }>(`/messages?${params.toString()}`, {
    signal,
  });
};

export interface SendSupportMessageInput {
  clientMessageId: string;
  body?: string;
  uploadIds?: string[];
  context?: SupportContextRef;
}

export const sendSupportMessage = (input: SendSupportMessageInput) =>
  call<{ message: SupportMessage; case: SupportCase | null }>('/messages', {
    method: 'POST',
    body: JSON.stringify({
      clientMessageId: input.clientMessageId,
      ...(input.body ? { body: input.body } : {}),
      ...(input.uploadIds?.length ? { uploadIds: input.uploadIds } : {}),
      ...(input.context
        ? {
            context: {
              kind: input.context.kind,
              ...(input.context.id ? { id: input.context.id } : {}),
            },
          }
        : {}),
    }),
  });

export const markSupportRead = (seq: number) =>
  call<{ lastReadSeq: number; unread: number }>('/read', {
    method: 'POST',
    body: JSON.stringify({ seq }),
  });

export const rateSupportCase = (caseId: string, score: number, comment?: string) =>
  call<SupportCase>(`/cases/${encodeURIComponent(caseId)}/csat`, {
    method: 'POST',
    body: JSON.stringify({ score, ...(comment?.trim() ? { comment: comment.trim() } : {}) }),
  });

export const uploadSupportFile = (file: SupportFile) => {
  const form = new FormData();
  if (file.blob) {
    form.append('file', file.blob, file.name);
  } else if (file.uri) {
    // React Native's FormData takes a { uri, name, type } descriptor for a local file.
    form.append('file', { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);
  } else {
    throw new SupportApiError(400, 'No file to upload');
  }
  return call<SupportUpload>('/uploads', { method: 'POST', body: form });
};
