import { produce } from 'immer';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { SignupUser, Status, StatusInfo, User } from '@/lib/types';

interface UserState {
  users: User[];
  signupInfo: StatusInfo;
  loginInfo: StatusInfo;
  signupUser: SignupUser;
  safeAddressSynced: Record<string, boolean>;
  _hasHydrated: boolean;
  storeUser: (user: User) => void;
  updateUser: (user: User) => void;
  selectUserById: (userId: string) => void;
  unselectUser: () => void;
  removeUsers: () => void;
  setSignupInfo: (info: StatusInfo) => void;
  setLoginInfo: (info: StatusInfo) => void;
  setSignupUser: (user: SignupUser) => void;
  markSafeAddressSynced: (userId: string) => void;
  setHasHydrated: (state: boolean) => void;
}

// Selectors - pure functions for deriving state
// These can be used with useUserStore(selector) for optimal re-render behavior

/** Get the currently selected user, or the only user if there's just one */
export const selectSelectedUser = ({ users }: UserState): User | undefined =>
  users.find(u => u.selected) ?? (users.length === 1 ? users[0] : undefined);

/** Get the credentialId of the selected user (for passkey filtering) */
export const selectSelectedCredentialId = (state: UserState): string | undefined => {
  return selectSelectedUser(state)?.credentialId;
};

export const useUserStore = create<UserState>()(
  persist(
    set => ({
      users: [],
      signupInfo: { status: Status.IDLE, message: '' },
      loginInfo: { status: Status.IDLE, message: '' },
      signupUser: { username: '' },
      safeAddressSynced: {},
      _hasHydrated: false,
      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),

      storeUser: (user: User) => {
        set(
          produce(state => {
            let isUserExists = false;
            state.users.forEach((prevUser: User) => {
              // Use userId for identification (backward compatible: also check username)
              if (prevUser.userId === user.userId || prevUser.username === user.username) {
                isUserExists = true;
                prevUser.selected = true;
                // Update existing user with new data
                Object.assign(prevUser, user);
              } else {
                prevUser.selected = false;
              }
            });

            if (!isUserExists) {
              state.users.push(user);
            }
          }),
        );
      },

      updateUser: (user: User) => {
        set(
          produce(state => {
            state.users = state.users.map((prevUser: User) =>
              // Use userId for identification (backward compatible: also check username)
              prevUser.userId === user.userId || prevUser.username === user.username
                ? user
                : prevUser,
            );
          }),
        );
      },

      // New: select by userId (preferred method)
      selectUserById: (userId: string) => {
        set(
          produce(state => {
            state.users = state.users.map((user: User) => ({
              ...user,
              selected: user.userId === userId,
            }));
          }),
        );
      },

      unselectUser: () => {
        set(
          produce(state => {
            state.users = state.users.map((user: User) => ({ ...user, selected: false }));
          }),
        );
      },

      removeUsers: () => {
        set({ users: [] });
      },

      setSignupInfo: info => set({ signupInfo: info }),
      setLoginInfo: info => set({ loginInfo: info }),

      setSignupUser: user => set({ signupUser: user }),

      markSafeAddressSynced: userId =>
        set(
          produce(state => {
            state.safeAddressSynced[userId] = true;
          }),
        ),
    }),
    {
      name: USER.storageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.storageKey)),
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
