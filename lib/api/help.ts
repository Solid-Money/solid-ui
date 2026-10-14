import { SupportApiError, supportCall } from '@/lib/api/support';

import type {
  HelpArticle,
  HelpArticleSummary,
  HelpCollection,
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

const isText = (value: unknown): value is string => typeof value === 'string';

const isArticleSummary = (value: unknown): value is HelpArticleSummary => {
  const article = value as HelpArticleSummary | null;
  return !!article && isText(article.id) && isText(article.slug) && isText(article.title);
};

const isCollection = (value: unknown, depth = 0): value is HelpCollection => {
  const collection = value as HelpCollection | null;
  return (
    !!collection &&
    depth < 8 &&
    isText(collection.slug) &&
    isText(collection.name) &&
    typeof collection.articleCount === 'number' &&
    Array.isArray(collection.articles) &&
    collection.articles.every(isArticleSummary) &&
    Array.isArray(collection.children) &&
    collection.children.every(child => isCollection(child, depth + 1))
  );
};

/** The shape the help center screens read; anything else is refused before it is shown or cached. */
export const isHelpHome = (value: unknown): value is HelpHome => {
  const home = value as HelpHome | null;
  return (
    !!home &&
    Array.isArray(home.collections) &&
    home.collections.every(collection => isCollection(collection)) &&
    Array.isArray(home.otherArticles) &&
    home.otherArticles.every(isArticleSummary)
  );
};

export const getHelpHome = async (signal?: AbortSignal): Promise<HelpHome> => {
  const home = await supportCall<unknown>('/help/home', { signal });
  if (!isHelpHome(home)) {
    throw new SupportApiError(502, 'The help center sent something unexpected');
  }
  return home;
};

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
