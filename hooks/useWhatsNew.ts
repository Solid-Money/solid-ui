import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';

import { fetchLatestWhatsNew } from '@/lib/api';
import mmkvStorage from '@/lib/mmvkStorage';
import { useWhatsNewStore } from '@/store/useWhatsNewStore';

const storage = mmkvStorage('whats-new');
const SEEN_IDS_KEY = 'seen_popup_ids';
const DISMISSED_IDS_KEY = 'dismissed_popup_ids';
const WHATS_NEW_KEY = 'whats-new';

const getSeenIds = (): string[] => {
  const data = storage.getItem(SEEN_IDS_KEY);
  return data ? JSON.parse(data) : [];
};

const getDismissedIds = (): string[] => {
  const data = storage.getItem(DISMISSED_IDS_KEY);
  return data ? JSON.parse(data) : [];
};

export const useWhatsNew = () => {
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { whatsNew, isVisible, setWhatsNew, setIsVisible } = useWhatsNewStore(
    useShallow(state => ({
      whatsNew: state.whatsNew,
      isVisible: state.isVisible,
      setWhatsNew: state.setWhatsNew,
      setIsVisible: state.setIsVisible,
    })),
  );

  // Track which data ID has been processed to detect new WhatsNew content
  const processedDataIdRef = useRef<string | null>(null);

  const {
    data,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: [WHATS_NEW_KEY],
    queryFn: fetchLatestWhatsNew,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Handle data updates and auto-show logic
  const handleWhatsNewData = useCallback(
    (latest: Awaited<ReturnType<typeof fetchLatestWhatsNew>>, forceShow = false) => {
      if (latest && latest.isActive) {
        setWhatsNew(latest);

        if (forceShow) {
          setIsVisible(true);
          return;
        }

        const seenIds = getSeenIds();
        if (latest.showOnLoad && !seenIds.includes(latest._id)) {
          setIsVisible(true);
        }
      }
    },
    [setIsVisible, setWhatsNew],
  );

  // React to data from React Query - process when new content arrives
  // Tracking by ID ensures new WhatsNew content is properly detected
  useEffect(() => {
    if (data && data._id !== processedDataIdRef.current) {
      processedDataIdRef.current = data._id;
      handleWhatsNewData(data, false);
    }
  }, [data, handleWhatsNewData]);

  const checkWhatsNew = useCallback(
    async (forceShow = false) => {
      try {
        const { data: freshData } = await refetch();
        if (freshData) {
          handleWhatsNewData(freshData, forceShow);
        }
      } catch (error) {
        console.error("Failed to fetch What's New:", error);
      }
    },
    [refetch, handleWhatsNewData],
  );

  const markAsSeen = useCallback((id: string) => {
    const seenIds = getSeenIds();
    if (!seenIds.includes(id)) {
      storage.setItem(SEEN_IDS_KEY, JSON.stringify([...seenIds, id]));
    }
  }, []);

  const markAsDismissed = useCallback((id: string) => {
    const dismissedIds = getDismissedIds();
    if (!dismissedIds.includes(id)) {
      storage.setItem(DISMISSED_IDS_KEY, JSON.stringify([...dismissedIds, id]));
    }
  }, []);

  // Memoize to avoid parsing JSON from storage on every render
  const isButtonDismissed = useMemo(() => {
    return whatsNew ? getDismissedIds().includes(whatsNew._id) : false;
  }, [whatsNew]);

  const closeWhatsNew = useCallback(() => {
    if (whatsNew) {
      markAsSeen(whatsNew._id);
    }
    setIsVisible(false);
  }, [whatsNew, markAsSeen, setIsVisible]);

  const dismissButton = useCallback(() => {
    if (whatsNew) {
      markAsDismissed(whatsNew._id);
      // Since isButtonDismissed is a derived value from MMKV storage,
      // we must force a re-render by updating the global store with a
      // new object reference. This ensures the UI (like the Navbar button)
      // re-evaluates its visibility immediately after the database update.
      setWhatsNew({ ...whatsNew });
    }
  }, [whatsNew, markAsDismissed, setWhatsNew]);

  const showLatest = useCallback(() => {
    checkWhatsNew(true);
  }, [checkWhatsNew]);

  return {
    whatsNew,
    isVisible,
    loading,
    isButtonDismissed,
    checkWhatsNew,
    closeWhatsNew,
    showLatest,
    dismissButton,
  };
};
