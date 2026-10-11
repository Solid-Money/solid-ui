import { supportCall } from '@/lib/api/support';

import type {
  HelpArticle,
  HelpCollectionPage,
  HelpHome,
  HelpRedirect,
  HelpSearchHit,
} from '@/lib/types/help';

/**
 * The help center (flash-support-service, `/support/v1/help/*`). Open to
 * everyone; with a session it also returns signed-in-only articles. Old
 * Intercom slugs (`13184959-legal-…`) and renamed ones answer `{ redirectTo }`.
 *
 * Backend: apps/flash-support-service/src/help in solid-backend.
 */

export const getHelpHome = (signal?: AbortSignal) =>
  supportCall<HelpHome>('/help/home', { signal });

export const getHelpCollection = (slug: string, signal?: AbortSignal) =>
  supportCall<HelpCollectionPage | HelpRedirect>(`/help/collections/${encodeURIComponent(slug)}`, {
    signal,
  });

export const getHelpArticle = (slug: string, signal?: AbortSignal) =>
  supportCall<HelpArticle | HelpRedirect>(`/help/articles/${encodeURIComponent(slug)}`, { signal });

export const searchHelp = (q: string, signal?: AbortSignal) =>
  supportCall<{ results: HelpSearchHit[] }>(
    `/help/search?q=${encodeURIComponent(q.trim().slice(0, 200))}&limit=20`,
    { signal },
  );

/** "Did this help?" One vote per user and article version; voting again changes it. */
export const sendHelpFeedback = (articleId: string, versionId: string, helpful: boolean) =>
  supportCall<{ recorded: true }>(`/help/articles/${encodeURIComponent(articleId)}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ versionId, helpful }),
  });

export const isHelpRedirect = (value: unknown): value is HelpRedirect =>
  !!value && typeof (value as HelpRedirect).redirectTo === 'string';
