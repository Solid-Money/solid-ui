/// <reference types="jest" />

import { User } from '@/lib/types';
import { selectSelectedCredentialIds, useUserStore } from '@/store/useUserStore';

// MMKV is a native module — back the persisted store with plain memory here.
// (jest.mock is hoisted above the import by babel-jest.)
jest.mock('@/lib/mmvkStorage', () => {
  const memory = new Map<string, string>();
  return {
    __esModule: true,
    default: () => ({
      setItem: (key: string, value: string) => memory.set(key, value),
      getItem: (key: string) => memory.get(key) ?? null,
      removeItem: (key: string) => memory.delete(key),
    }),
  };
});

const OLD = 'oAhWMPFN39CT9lJ1GNWzCA';
const RECOVERED = 'Zm5ld0NyZWRlbnRpYWxJZA';

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    userId: 'user-1',
    username: 'ji7186250',
    email: 'ji7186250@gmail.com',
    turnkeyUserId: '99f03552-ef0f-4374-9b09-f76545738d18',
    safeAddress: '0x07853745fea7396242C999Bc7bCcD8F64d387875',
    signWith: '0xBc82DaA01eBe5360C2eeD6d64C004A4db868DA22',
    suborgId: '13a64832-98d3-4e88-ba08-c7b67908866f',
    selected: true,
    ...overrides,
  }) as User;

const setUsers = (users: User[]) => useUserStore.setState({ users });
const currentUser = () => useUserStore.getState().users[0];

afterEach(() => setUsers([]));

/**
 * These values become WebAuthn's `allowCredentials` on every in-app passkey
 * prompt. Pinning them to a credential the authenticator no longer holds is
 * what let a recovered account log in (that prompt is unfiltered) and then fail
 * every action that re-prompts.
 */
describe('selectSelectedCredentialIds', () => {
  it('offers every credential the account holds', () => {
    setUsers([buildUser({ credentialId: RECOVERED, credentialIds: [OLD, RECOVERED] })]);

    expect(selectSelectedCredentialIds(useUserStore.getState())).toEqual([OLD, RECOVERED]);
  });

  it('falls back to the scalar for a row stored before the list existed', () => {
    setUsers([buildUser({ credentialId: OLD })]);

    expect(selectSelectedCredentialIds(useUserStore.getState())).toEqual([OLD]);
  });

  it('offers nothing when the account is unpinned', () => {
    // An empty list is what leaves the prompt unfiltered — the authenticator
    // then offers every passkey it holds for the relying party.
    setUsers([buildUser()]);

    expect(selectSelectedCredentialIds(useUserStore.getState())).toEqual([]);
  });

  it('ignores users who are not selected', () => {
    setUsers([
      buildUser({ userId: 'other', selected: false, credentialId: OLD }),
      buildUser({ userId: 'user-1', selected: true, credentialId: RECOVERED }),
    ]);

    expect(selectSelectedCredentialIds(useUserStore.getState())).toEqual([RECOVERED]);
  });
});

describe('setCredentialIdsForIdentity', () => {
  const setFor = (identity: { turnkeyUserId?: string; email?: string }, credentialIds: string[]) =>
    useUserStore.getState().setCredentialIdsForIdentity(identity, credentialIds);

  it('replaces the recovered account credentials, matched on the Turnkey user', () => {
    setUsers([buildUser({ credentialId: OLD, credentialIds: [OLD] })]);

    setFor({ turnkeyUserId: '99f03552-ef0f-4374-9b09-f76545738d18' }, [OLD, RECOVERED]);

    expect(currentUser().credentialIds).toEqual([OLD, RECOVERED]);
  });

  it('matches on email when the local row predates the Turnkey user id', () => {
    setUsers([buildUser({ turnkeyUserId: undefined, credentialId: OLD })]);

    setFor({ email: 'ji7186250@gmail.com' }, [RECOVERED]);

    expect(currentUser().credentialIds).toEqual([RECOVERED]);
  });

  it('matches email regardless of casing or padding', () => {
    setUsers([buildUser({ turnkeyUserId: undefined, credentialId: OLD })]);

    setFor({ email: '  JI7186250@Gmail.com ' }, [RECOVERED]);

    expect(currentUser().credentialIds).toEqual([RECOVERED]);
  });

  it('re-points the scalar when the old credential is gone', () => {
    // Leaving `credentialId` on a credential absent from the list would let the
    // two disagree, and older clients read the scalar.
    setUsers([buildUser({ credentialId: OLD, credentialIds: [OLD] })]);

    setFor({ turnkeyUserId: '99f03552-ef0f-4374-9b09-f76545738d18' }, [RECOVERED]);

    expect(currentUser().credentialId).toBe(RECOVERED);
  });

  it('keeps the scalar when it is still one of the credentials', () => {
    setUsers([buildUser({ credentialId: OLD, credentialIds: [OLD] })]);

    setFor({ turnkeyUserId: '99f03552-ef0f-4374-9b09-f76545738d18' }, [OLD, RECOVERED]);

    expect(currentUser().credentialId).toBe(OLD);
  });

  it('clears the pin when Turnkey could not be read', () => {
    // The fallback: an unfiltered prompt still works, where a stale pin cannot.
    setUsers([buildUser({ credentialId: OLD, credentialIds: [OLD] })]);

    setFor({ turnkeyUserId: '99f03552-ef0f-4374-9b09-f76545738d18' }, []);

    expect(currentUser().credentialId).toBeUndefined();
    expect(currentUser().credentialIds).toBeUndefined();
  });

  it('leaves other accounts on the device untouched', () => {
    setUsers([
      buildUser({ userId: 'user-1', credentialId: OLD, credentialIds: [OLD] }),
      buildUser({
        userId: 'user-2',
        turnkeyUserId: 'someone-else',
        email: 'other@example.com',
        credentialId: 'b3RoZXJDcmVkZW50aWFs',
      }),
    ]);

    setFor({ turnkeyUserId: '99f03552-ef0f-4374-9b09-f76545738d18' }, [RECOVERED]);

    expect(useUserStore.getState().users[1].credentialId).toBe('b3RoZXJDcmVkZW50aWFs');
  });

  it('does nothing when the identity matches no local account', () => {
    setUsers([buildUser({ credentialId: OLD, credentialIds: [OLD] })]);

    setFor({ turnkeyUserId: 'unknown', email: 'nobody@example.com' }, [RECOVERED]);

    expect(currentUser().credentialIds).toEqual([OLD]);
  });
});

describe('clearUserCredentialId', () => {
  it('drops both the scalar and the list Turnkey rejected', () => {
    // Leaving either behind pins every retry to the same unusable passkeys.
    setUsers([buildUser({ credentialId: OLD, credentialIds: [OLD, RECOVERED] })]);

    useUserStore.getState().clearUserCredentialId('user-1');

    expect(currentUser().credentialId).toBeUndefined();
    expect(currentUser().credentialIds).toBeUndefined();
    expect(selectSelectedCredentialIds(useUserStore.getState())).toEqual([]);
  });
});
