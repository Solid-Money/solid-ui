import { create } from 'zustand';

import { ActivityEvents } from '@/lib/types';

/** Runtime-only state shared by Home, Activity and their nested feed hooks. */
export const useAccountRefreshStore = create<{
  refreshingByUser: Record<string, boolean>;
  latestPageByUser: Record<string, ActivityEvents>;
}>(() => ({ refreshingByUser: {}, latestPageByUser: {} }));
