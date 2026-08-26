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
  redirectFrom: string | null;
  /**
   * userId awaiting passkey authentication after the welcome-page user
   * selection. Scoped to a single session — survives the TurnkeyProvider
   * re-mount triggered by credentialId changes but is not persisted.
   */
  pendingAuthUserId: string | null;
  _hasHydrated: boolean;
  storeUser: (user: User) => void;
  updateUser: (user: User) => void;
  selectUserById: (userId: string) => void;
  unselectUser: () => void;
  clearUserCredentialId: (userId: string) => void;
  setCredentialIdsForIdentity: (
    identity: { turnkeyUserId?: string; email?: string },
    credentialIds: string[],
  ) => void;
  removeUsers: () => void;
  setSignupInfo: (info: StatusInfo) => void;
  setLoginInfo: (info: StatusInfo) => void;
  setSignupUser: (user: SignupUser) => void;
  markSafeAddressSynced: (userId: string) => void;
  setRedirectFrom: (path: string | null) => void;
  setPendingAuthUserId: (userId: string | null) => void;
  setHasHydrated: (state: boolean) => void;
}

// Selectors - pure functions for deriving state
// These can be used with useUserStore(selector) for optimal re-render behavior

/** Get the currently selected user */
export const selectSelectedUser = ({ users }: UserState): User | undefined =>
  users.find(u => u.selected);

/**
 * Every credential the selected user can present, for passkey filtering.
 *
 * Passkey recovery adds an authenticator rather than replacing the lost one, so
 * an account can hold several. Offering all of them keeps the prompt a single
 * tap — the authenticator silently picks the one it actually has — while
 * offering just one strands the user whenever that one is not the one on this
 * device. Falls back to the scalar for rows stored before the list existed.
 */
export const selectSelectedCredentialIds = (state: UserState): string[] => {
  const user = selectSelectedUser(state);
  if (user?.credentialIds?.length) return user.credentialIds;
  return user?.credentialId ? [user.credentialId] : [];
};

export const useUserStore = create<UserState>()(
  persist(
    set => ({
      users: [],
      signupInfo: { status: Status.IDLE, message: '' },
      loginInfo: { status: Status.IDLE, message: '' },
      signupUser: { username: '' },
      safeAddressSynced: {},
      redirectFrom: null,
      pendingAuthUserId: null,
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

      /**
       * Drop the stored credentials of a user Turnkey has rejected as unknown.
       * They feed TurnkeyProvider's `allowCredentials`, so leaving them in place
       * pins every retry to the same unusable passkeys — clearing them lets the
       * authenticator offer all of the user's passkeys for the relying party
       * instead.
       */
      clearUserCredentialId: (userId: string) => {
        set(
          produce(state => {
            const user = state.users.find((u: User) => u.userId === userId);
            if (user) {
              user.credentialId = undefined;
              user.credentialIds = undefined;
            }
          }),
        );
      },

      /**
       * Replace the remembered credentials of the account that just recovered
       * its passkey with the set Turnkey now holds for it.
       *
       * The stored values feed TurnkeyProvider's `allowCredentials`. Left
       * pointing at the passkey the user lost, they pin every subsequent prompt
       * to a credential that can never be presented again — which is why
       * recovery must overwrite them rather than wait for the next login.
       *
       * Passing an empty list clears the pin, which makes the next prompt
       * unfiltered: correct, but a fallback rather than the goal, since the
       * authenticator then offers every passkey it holds for the relying party.
       *
       * Matched on the Turnkey user id (what the recovery flow knows) with the
       * recovery email as a fallback, since the local row predates recovery and
       * may only carry the email.
       */
      setCredentialIdsForIdentity: ({ turnkeyUserId, email }, credentialIds) => {
        const normalizedEmail = email?.trim().toLowerCase();
        set(
          produce(state => {
            state.users.forEach((user: User) => {
              const matchesTurnkeyUser = !!turnkeyUserId && user.turnkeyUserId === turnkeyUserId;
              const matchesEmail =
                !!normalizedEmail && user.email?.trim().toLowerCase() === normalizedEmail;
              if (!matchesTurnkeyUser && !matchesEmail) return;

              user.credentialIds = credentialIds.length ? credentialIds : undefined;
              // Keep the scalar inside the set so the two can never disagree.
              user.credentialId = credentialIds.includes(user.credentialId ?? '')
                ? user.credentialId
                : credentialIds[0];
            });
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

      setRedirectFrom: (path: string | null) => set({ redirectFrom: path }),

      setPendingAuthUserId: (userId: string | null) => set({ pendingAuthUserId: userId }),
    }),
    {
      name: USER.storageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.storageKey)),
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true);
      },
      partialize: state => {
        const { redirectFrom, pendingAuthUserId, ...rest } = state;
        return rest;
      },
    },
  ),
);
