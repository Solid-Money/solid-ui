import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

import type { AvatarColorId } from '@/components/Profile/avatarColors';

interface ProfileAvatarState {
  /** The colour each account picked for its avatar, by user id. */
  colorByUserId: Record<string, AvatarColorId>;
  setColor: (userId: string, color: AvatarColorId) => void;
}

const PROFILE_AVATAR_STORAGE_KEY = 'profile-avatar-storage';

/**
 * The avatar colour, kept on this device only.
 *
 * The backend has nowhere to store an avatar yet, so the choice does not follow
 * the account to another device. Keyed by user id so switching accounts on one
 * device shows each its own colour.
 */
export const useProfileAvatarStore = create<ProfileAvatarState>()(
  persist(
    set => ({
      colorByUserId: {},
      setColor: (userId, color) =>
        set(state => ({ colorByUserId: { ...state.colorByUserId, [userId]: color } })),
    }),
    {
      name: PROFILE_AVATAR_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(PROFILE_AVATAR_STORAGE_KEY)),
    },
  ),
);

/** The colour `userId` picked, or undefined when they never picked one. */
export const useProfileAvatarColorId = (userId: string | undefined) =>
  useProfileAvatarStore(state => (userId ? state.colorByUserId[userId] : undefined));
