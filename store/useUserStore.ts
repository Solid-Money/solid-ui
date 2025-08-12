import { produce } from 'immer';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { Status, StatusInfo, User } from '@/lib/types';

interface UserState {
  users: User[];
  signupInfo: StatusInfo;
  loginInfo: StatusInfo;
  storeUser: (user: User) => void;
  updateUser: (user: User) => void;
  selectUser: (username: string) => void;
  unselectUser: () => void;
  removeUsers: () => void;
  setSignupInfo: (info: StatusInfo) => void;
  setLoginInfo: (info: StatusInfo) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    set => ({
      users: [],
      signupInfo: { status: Status.IDLE, message: '' },
      loginInfo: { status: Status.IDLE, message: '' },

      storeUser: (user: User) => {
        set(
          produce(state => {
            let isUserExists = false;
            state.users.forEach((prevUser: User) => {
              if (prevUser.username === user.username) {
                isUserExists = true;
                prevUser.selected = true;
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
              prevUser.username === user.username ? user : prevUser,
            );
          }),
        );
      },

      selectUser: (username: string) => {
        set(
          produce(state => {
            state.users = state.users.map((user: User) => ({
              ...user,
              selected: user.username === username,
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
    }),
    {
      name: USER.storageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.storageKey)),
    },
  ),
);
