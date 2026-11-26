import { useCallback, useEffect, useMemo, useRef } from 'react';
import { onlineManager, useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';

import { fetchLatestWhatsNew } from '@/lib/api';
import mmkvStorage from '@/lib/mmvkStorage';
import { WhatsNew } from '@/lib/types';
import { canShowWhatsNew } from '@/lib/whatsNew';
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
    failedIds,
    setWhatsNew,
    setIsVisible,
    setInitialStep,
    clearRequest,
    markFailed,
  } = useWhatsNewStore(
    useShallow(state => ({
      whatsNew: state.whatsNew,
      isVisible: state.isVisible,
      initialStep: state.initialStep,
      request: state.request,
      failedIds: state.failedIds,
      setWhatsNew: state.setWhatsNew,
      setIsVisible: state.setIsVisible,
      setInitialStep: state.setInitialStep,
      clearRequest: state.clearRequest,
      markFailed: state.markFailed,
    })),
  );

  // The server's answer last written to the store, so each answer is written once.
  const appliedDataRef = useRef<WhatsNew | null | undefined>(undefined);

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
      // A format this build can't draw is skipped rather than shown broken.
      if (latest && latest.isActive && canShowWhatsNew(latest)) {
        setWhatsNew(latest);

        if (forceShow) {
          setIsVisible(true);
        }
      }
    },
    [setIsVisible, setWhatsNew],
  );

  // Keeps the stored copy the server's latest answer, so the auto-open below
  // decides on what an admin set now. Applied whenever the answer changes, not
  // only when its id does: switching "Show on App Load" off, or editing, the
  // announcement this session already holds keeps its id, and the stale copy
  // would still open on load. "Nothing active" (or a format this build can't
  // draw) clears it, so an announcement switched off is not auto-opened from
  // the session's old copy either. React Query keeps an unchanged answer's
  // reference, so a refetch that changed nothing writes nothing.
  //
  // A popup on screen is left as it is: replacing it would restart it and count
  // another view, and clearing it would close it under the user. The answer is
  // applied once it closes.
  useEffect(() => {
    if (data === undefined || isVisible || appliedDataRef.current === data) return;
    appliedDataRef.current = data;
    setWhatsNew(data?.isActive && canShowWhatsNew(data) ? data : null);
  }, [data, isVisible, setWhatsNew]);

  // Start the auto-open delay only when Home has finished its initial loading.
  // The settings button still opens the modal immediately via forceShow.
  //
  // A link's pending ask holds it back: the link is answered below, on the page
  // it names, once the server has been asked. On a slow start that can take
  // longer than this delay, and opening here first would show page 1 and then
  // jump to the linked page (or show a stale announcement the link replaces).
  useEffect(() => {
    if (
      !autoShowOnHome ||
      request ||
      !whatsNew?.isActive ||
      !whatsNew.showOnLoad ||
      isVisible ||
      failedIds.includes(whatsNew._id) ||
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
  }, [autoShowOnHome, failedIds, isVisible, request, setIsVisible, whatsNew]);

  // A link asked for an announcement on a given page (`?whatsNew=<id>&whatsNewStep=<n>`,
  // see `useHomeLinkAction`). Only one announcement is active at a time, so the
  // ask is answered from the latest one: on the page named when it is the same
  // announcement, on its first page when it has since been replaced (the link
  // is old, the popup it promised is still the right one to show), and not at
  // all when nothing is active, rather than reviving one an admin switched off.
  // A single image or video has no pages: it opens as it is, whatever page the
  // link named.
  useEffect(() => {
    if (!request) return;
    let cancelled = false;

    const answer = async () => {
      let latest = useWhatsNewStore.getState().whatsNew;
      // Whether `latest` is the server's answer rather than this session's copy.
      let isFromServer = false;
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
          if (result !== OFFLINE && result.isSuccess) {
            latest = result.data;
            isFromServer = true;
          }
        } catch (error) {
          console.error("Failed to fetch What's New for a link:", error);
        } finally {
          unsubscribe();
        }
      }
      if (cancelled) return;

      // Nothing active, or a format this build can't draw: Home stays as it is.
      if (!latest?.isActive || !canShowWhatsNew(latest)) {
        // The server said so, so the stored copy goes too. Otherwise the
        // auto-open, free again once the ask is cleared, would show the
        // announcement the server no longer offers. A popup open at the time
        // closes with it: left visible, the next announcement stored would
        // open at once, past the auto-open's delay and seen check, on this
        // one's page.
        if (isFromServer) {
          setWhatsNew(null);
          setIsVisible(false);
          setInitialStep(0);
        }
        clearRequest();
        return;
      }
      clearRequest();

      setWhatsNew(latest);
      setInitialStep(
        latest.format !== 'single' && latest._id === request.id
          ? clampStep(request.step, latest)
          : 0,
      );
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

  /**
   * Closes a popup that never appeared because its image or video poster failed
   * to load. It is not marked as seen, so it comes back on the next launch.
   */
  const abandonWhatsNew = useCallback(() => {
    if (whatsNew) {
      markFailed(whatsNew._id);
    }
    setIsVisible(false);
    setInitialStep(0);
  }, [whatsNew, markFailed, setIsVisible, setInitialStep]);

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
    abandonWhatsNew,
    showLatest,
    dismissButton,
  };
};
