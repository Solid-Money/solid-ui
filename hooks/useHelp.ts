import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useSupportChatEnabled } from '@/hooks/useSupportChat';
import {
  getHelpArticle,
  getHelpCollection,
  getHelpHome,
  isHelpHome,
  isHelpRedirect,
  searchHelp,
} from '@/lib/api/help';
import { setNativeHelpEnabled } from '@/lib/help/links';
import { useHelpCacheStore } from '@/store/useHelpCacheStore';

import type { HelpArticle, HelpCollectionPage, HelpRedirect } from '@/lib/types/help';

const STALE_MS = 5 * 60_000;

/**
 * Whether this user reads the help center in the app. It ships with the
 * in-house chat (same `supportChat` feature and support API): before that,
 * help links keep opening the website.
 */
export const useHelpCenterEnabled = (): boolean => useSupportChatEnabled();

/** Mounted once in the protected layout: lets `openHelpLink` route in the app. */
export const useSyncNativeHelp = () => {
  const enabled = useHelpCenterEnabled();
  useEffect(() => {
    setNativeHelpEnabled(enabled);
  }, [enabled]);
};

export const useHelpHome = () => {
  const saved = useHelpCacheStore(state => state.home);
  // A copy saved by an older build is only shown if it still has the shape the screen reads.
  const cached = saved && isHelpHome(saved.value) ? saved : null;
  return useQuery({
    queryKey: ['help', 'home'],
    queryFn: async ({ signal }) => {
      const home = await getHelpHome(signal);
      useHelpCacheStore.getState().saveHome(home);
      return home;
    },
    // What this device read last shows at once; the network refreshes it.
    initialData: cached?.value,
    initialDataUpdatedAt: cached ? 0 : undefined,
    staleTime: STALE_MS,
  });
};

export const useHelpArticle = (slug: string) => {
  const cached = useHelpCacheStore(state => state.articles[slug]);
  return useQuery<HelpArticle | HelpRedirect>({
    queryKey: ['help', 'article', slug],
    queryFn: async ({ signal }) => {
      const result = await getHelpArticle(slug, signal);
      if (!isHelpRedirect(result)) useHelpCacheStore.getState().saveArticle(result);
      return result;
    },
    initialData: cached?.value,
    initialDataUpdatedAt: cached ? 0 : undefined,
    staleTime: STALE_MS,
    enabled: !!slug,
  });
};

export const useHelpCollection = (slug: string) => {
  const cached = useHelpCacheStore(state => state.collections[slug]);
  return useQuery<HelpCollectionPage | HelpRedirect>({
    queryKey: ['help', 'collection', slug],
    queryFn: async ({ signal }) => {
      const result = await getHelpCollection(slug, signal);
      if (!isHelpRedirect(result)) useHelpCacheStore.getState().saveCollection(result);
      return result;
    },
    initialData: cached?.value,
    initialDataUpdatedAt: cached ? 0 : undefined,
    staleTime: STALE_MS,
    enabled: !!slug,
  });
};

/** The value once it has stopped changing for `ms`. */
export const useDebounced = <T>(value: T, ms: number): T => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
};

export const useHelpSearch = (query: string) => {
  const q = useDebounced(query.trim(), 250);
  return useQuery({
    queryKey: ['help', 'search', q],
    queryFn: ({ signal }) => searchHelp(q, signal).then(result => result.results),
    enabled: q.length >= 2,
    staleTime: STALE_MS,
  });
};
