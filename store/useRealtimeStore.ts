import { create } from 'zustand';

/**
 * Where the app's realtime socket stands.
 *
 * - `idle`: no signed-in user, or not started yet.
 * - `connecting`: first attempt, or retrying after the connection dropped.
 * - `connected`: live — card, activity and balance changes arrive as they happen.
 * - `unavailable`: the server refused us, or we gave up retrying for now; data
 *   falls back to polling until the next attempt succeeds.
 */
export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'unavailable';

interface RealtimeState {
  status: RealtimeStatus;
  setStatus: (status: RealtimeStatus) => void;
}

/**
 * Written only by the realtime client (`lib/realtime`). Read through a
 * selector — `useRealtimeStore(state => state.status === 'connected')` — so a
 * component re-renders when the socket comes up or goes down, and at no other
 * time.
 */
export const useRealtimeStore = create<RealtimeState>()(set => ({
  status: 'idle',
  setStatus: status => set(state => (state.status === status ? state : { status })),
}));

/** Whether live updates are flowing right now. */
export const selectIsRealtimeLive = (state: RealtimeState) => state.status === 'connected';
