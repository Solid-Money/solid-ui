import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

import type { HelpArticle, HelpCollectionPage, HelpHome } from '@/lib/types/help';

const MAX_ARTICLES = 40;
const MAX_COLLECTIONS = 20;

interface Saved<T> {
  value: T;
  savedAt: number;
}

interface HelpCacheState {
  home: Saved<HelpHome> | null;
  articles: Record<string, Saved<HelpArticle>>;
  collections: Record<string, Saved<HelpCollectionPage>>;
  /** This device's "Did this help?" answers, by article version. */
  votes: Record<string, boolean>;
  saveHome: (home: HelpHome) => void;
  saveArticle: (article: HelpArticle) => void;
  saveCollection: (page: HelpCollectionPage) => void;
  saveVote: (versionId: string, helpful: boolean) => void;
}

function keepNewest<T>(entries: Record<string, Saved<T>>, max: number): Record<string, Saved<T>> {
  const sorted = Object.entries(entries).sort(([, a], [, b]) => b.savedAt - a.savedAt);
  return Object.fromEntries(sorted.slice(0, max));
}

/**
 * The help center as last read, kept on the device so articles open offline
 * and instantly; the screens refresh them in the background. Help content is
 * public, so it is not encrypted.
 */
export const useHelpCacheStore = create<HelpCacheState>()(
  persist(
    set => ({
      home: null,
      articles: {},
      collections: {},
      votes: {},
      saveHome: home => set({ home: { value: home, savedAt: Date.now() } }),
      saveArticle: article =>
        set(state => ({
          articles: keepNewest(
            { ...state.articles, [article.slug]: { value: article, savedAt: Date.now() } },
            MAX_ARTICLES,
          ),
        })),
      saveCollection: page =>
        set(state => ({
          collections: keepNewest(
            { ...state.collections, [page.collection.slug]: { value: page, savedAt: Date.now() } },
            MAX_COLLECTIONS,
          ),
        })),
      saveVote: (versionId, helpful) =>
        set(state => ({
          votes: Object.fromEntries(
            [...Object.entries(state.votes), [versionId, helpful] as const].slice(-200),
          ),
        })),
    }),
    {
      name: 'help-cache',
      version: 1,
      storage: createJSONStorage(() => mmkvStorage('solid_help')),
    },
  ),
);
