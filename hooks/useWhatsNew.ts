import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { fetchLatestWhatsNew } from '@/lib/api';
import mmkvStorage from '@/lib/mmvkStorage';
import { useWhatsNewStore } from '@/store/useWhatsNewStore';

const storage = mmkvStorage('whats-new');
const SEEN_IDS_KEY = 'seen_popup_ids';
const DISMISSED_IDS_KEY = 'dismissed_popup_ids';

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
  const [loading, setLoading] = useState(true);

  const getSeenIds = (): string[] => {
    const data = storage.getItem(SEEN_IDS_KEY);
    return data ? JSON.parse(data) : [];
  };

  const getDismissedIds = (): string[] => {
    const data = storage.getItem(DISMISSED_IDS_KEY);
    return data ? JSON.parse(data) : [];
  };

  const markAsSeen = (id: string) => {
    const seenIds = getSeenIds();
    if (!seenIds.includes(id)) {
      storage.setItem(SEEN_IDS_KEY, JSON.stringify([...seenIds, id]));
    }
  };

  const markAsDismissed = (id: string) => {
    const dismissedIds = getDismissedIds();
    if (!dismissedIds.includes(id)) {
      storage.setItem(DISMISSED_IDS_KEY, JSON.stringify([...dismissedIds, id]));
    }
  };

  const isButtonDismissed = whatsNew ? getDismissedIds().includes(whatsNew._id) : false;

  const checkWhatsNew = useCallback(
    async (forceShow = false) => {
      try {
        setLoading(true);
        const latest = await fetchLatestWhatsNew();

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
      } catch (error) {
        console.error("Failed to fetch What's New:", error);
      } finally {
        setLoading(false);
      }
    },
    [setIsVisible, setWhatsNew],
  );

  useEffect(() => {
    checkWhatsNew();
  }, [checkWhatsNew]);

  const closeWhatsNew = () => {
    if (whatsNew) {
      markAsSeen(whatsNew._id);
    }
    setIsVisible(false);
  };

  const dismissButton = () => {
    if (whatsNew) {
      markAsDismissed(whatsNew._id);
      // Since isButtonDismissed is a derived value from MMKV storage,
      // we must force a re-render by updating the global store with a
      // new object reference. This ensures the UI (like the Navbar button)
      // re-evaluates its visibility immediately after the database update.
      setWhatsNew({ ...whatsNew });
    }
  };

  const showLatest = () => {
    checkWhatsNew(true);
  };

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
