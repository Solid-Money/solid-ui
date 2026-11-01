import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

import type { IncidentNotice } from '@/lib/utils/incidentNotice';

/** Enough for any run of incidents; older entries are long past mattering. */
const MEMORY_LIMIT = 50;

const INCIDENT_NOTICE_STORAGE_KEY = 'incident-notice-storage';

interface IncidentNoticeState {
  /** Notice keys (`id@updatedAt`) closed on this device. */
  dismissed: string[];
  /** Incident ids shown on this device while they were active. */
  seen: string[];
  dismiss: (keys: string[]) => void;
  markSeen: (ids: string[]) => void;
  /** The notice the details sheet shows: what was tapped, even if a refetch changes the card. */
  sheetNotice: IncidentNotice | null;
  isSheetOpen: boolean;
  openSheet: (notice: IncidentNotice) => void;
  setSheetOpen: (open: boolean) => void;
}

const remember = (list: string[], items: string[]): string[] =>
  [...list.filter(item => !items.includes(item)), ...items].slice(-MEMORY_LIMIT);

/**
 * What this device did with the Home incident notice. Not authoritative:
 * losing it costs nothing worse than seeing a notice again.
 */
export const useIncidentNoticeStore = create<IncidentNoticeState>()(
  persist(
    set => ({
      dismissed: [],
      seen: [],
      dismiss: keys => set(state => ({ dismissed: remember(state.dismissed, keys) })),
      markSeen: ids =>
        set(state =>
          ids.every(id => state.seen.includes(id)) ? state : { seen: remember(state.seen, ids) },
        ),
      sheetNotice: null,
      isSheetOpen: false,
      openSheet: notice => set({ sheetNotice: notice, isSheetOpen: true }),
      setSheetOpen: open => set({ isSheetOpen: open }),
    }),
    {
      name: INCIDENT_NOTICE_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(INCIDENT_NOTICE_STORAGE_KEY)),
      partialize: ({ dismissed, seen }) => ({ dismissed, seen }),
    },
  ),
);
