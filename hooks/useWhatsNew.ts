import { useCallback, useEffect, useMemo, useRef } from 'react';
import { onlineManager, useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';

import { fetchLatestWhatsNew } from '@/lib/api';
import mmkvStorage from '@/lib/mmvkStorage';
import { WhatsNew } from '@/lib/types';
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

/** `step` as a page `whatsNew` has: a link may name a page that was since removed. */
const clampStep = (step: number, whatsNew: WhatsNew) =>
  Math.max(0, Math.min(step, whatsNew.steps.length - 1));

const OFFLINE = Symbol('offline');

/**
 * Settles once the device goes offline. A refresh that fails then is paused
 * until the connection is back, and its promise with it.
 */
const whenOffline = () => {
  let unsubscribe = () => {};
  const offline = new Promise<typeof OFFLINE>(resolve => {
    unsubscribe = onlineManager.subscribe(online => {
      if (!online) resolve(OFFLINE);
    });
  });
  return { offline, unsubscribe };
};

export const useWhatsNew = (autoShowOnHome = false) => {
  // Use useShallow for object selection to prevent unnecessary re-renders
  const {
    whatsNew,
    isVisible,
    initialStep,
    request,
    setWhatsNew,
    setIsVisible,
    setInitialStep,
    clearRequest,
  } = useWhatsNewStore(
    useShallow(state => ({
      whatsNew: state.whatsNew,
      isVisible: state.isVisible,
      initialStep: state.initialStep,
      request: state.request,
      setWhatsNew: state.setWhatsNew,
      setIsVisible: state.setIsVisible,
      setInitialStep: state.setInitialStep,
      clearRequest: state.clearRequest,
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
    refetchOnMount: true, // Ensure WhatsNew is fetched on first load
  });

  // Keep the latest content available to the modal and settings button.
  const handleWhatsNewData = useCallback(
    (latest: Awaited<ReturnType<typeof fetchLatestWhatsNew>>, forceShow = false) => {
      if (latest && latest.isActive) {
        setWhatsNew(latest);

        if (forceShow) {
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

  // Start the auto-open delay only when Home has finished its initial loading.
  // The settings button still opens the modal immediately via forceShow.
  useEffect(() => {
    if (
      !autoShowOnHome ||
      !whatsNew?.isActive ||
      !whatsNew.showOnLoad ||
      isVisible ||
      getSeenIds().includes(whatsNew._id)
    ) {
      return;
    }

    const timer = setTimeout(() => {
      if (!getSeenIds().includes(whatsNew._id)) {
        setIsVisible(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [autoShowOnHome, isVisible, setIsVisible, whatsNew]);

  // A link asked for an announcement on a given page (`?whatsNew=<id>&whatsNewStep=<n>`,
  // see `useHomeLinkAction`). Only one announcement is active at a time, so the
  // ask is answered from the latest one: on the page named when it is the same
  // announcement, on its first page when it has since been replaced (the link
  // is old, the popup it promised is still the right one to show), and not at
  // all when nothing is active, rather than reviving one an admin switched off.
  useEffect(() => {
    if (!request) return;
    let cancelled = false;

    const answer = async () => {
      let latest = useWhatsNewStore.getState().whatsNew;
      // Asked of the server even when the stored copy is the linked one: that
      // copy is as old as the session, and an admin may have since replaced or
      // switched it off. Offline it is all there is, and a refetch would wait
      // for a connection with the tap unanswered, so going offline while the
      // refresh is out answers with it too. The refresh's late result then only
      // updates the query; this request has been answered.
      if (onlineManager.isOnline()) {
        const { offline, unsubscribe } = whenOffline();
        try {
          const result = await Promise.race([refetch(), offline]);
          // A failed refresh keeps the last data beside its error, so only a
          // successful one is the server's answer, "nothing active" included.
          if (result !== OFFLINE && result.isSuccess) latest = result.data;
        } catch (error) {
          console.error("Failed to fetch What's New for a link:", error);
        } finally {
          unsubscribe();
        }
      }
      if (cancelled) return;

      clearRequest();
      if (!latest?.isActive || latest.steps.length === 0) return;

      setWhatsNew(latest);
      setInitialStep(latest._id === request.id ? clampStep(request.step, latest) : 0);
      setIsVisible(true);
    };

    void answer();
    return () => {
      cancelled = true;
    };
  }, [request, refetch, clearRequest, setWhatsNew, setInitialStep, setIsVisible]);

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
    // A linked page is for that one opening; the next one starts at the top.
    setInitialStep(0);
  }, [whatsNew, markAsSeen, setIsVisible, setInitialStep]);

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
    setInitialStep(0);
    checkWhatsNew(true);
  }, [checkWhatsNew, setInitialStep]);

  return {
    whatsNew,
    isVisible,
    initialStep,
    loading,
    isButtonDismissed,
    checkWhatsNew,
    closeWhatsNew,
    showLatest,
    dismissButton,
  };
};
