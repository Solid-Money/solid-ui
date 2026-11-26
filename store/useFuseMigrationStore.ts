import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

/**
 * Whether this device has shown the "Move your funds to Base" popup, per user.
 *
 * The popup opens once; after that the card pane's banner is the way in. Keyed by user so a
 * second account on the same device still gets its own popup.
 */
interface FuseMigrationState {
  noticeSeenBy: Record<string, true>;
  markNoticeSeen: (userId: string) => void;
}

const FUSE_MIGRATION_STORAGE_KEY = 'fuse-migration-storage';

export const useFuseMigrationStore = create<FuseMigrationState>()(
  persist(
    set => ({
      noticeSeenBy: {},
      markNoticeSeen: (userId: string) =>
        set(state => ({ noticeSeenBy: { ...state.noticeSeenBy, [userId]: true } })),
    }),
    {
      name: FUSE_MIGRATION_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(FUSE_MIGRATION_STORAGE_KEY)),
    },
  ),
);
