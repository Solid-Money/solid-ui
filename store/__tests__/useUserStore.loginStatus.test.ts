/// <reference types="jest" />

import { Status } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';

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

const storage = () => useUserStore.persist.getOptions().storage!;
const storageKey = () => useUserStore.persist.getOptions().name!;

afterEach(() => {
  useUserStore.setState({ loginInfo: { status: Status.IDLE, message: '' } });
});

/**
 * The login status is the state of one request, and the onboarding screen
 * disables Log in while it says "pending". Persisting it meant an interrupted
 * login — the app killed during the passkey prompt, or a request to a backend
 * that never answered — locked the user out behind "Authenticating..." across
 * every later launch.
 */
describe('login status is never restored from storage', () => {
  it('does not write an in-flight login to storage', async () => {
    useUserStore.getState().setLoginInfo({ status: Status.PENDING });

    const stored = await storage().getItem(storageKey());

    expect(stored?.state).not.toHaveProperty('loginInfo');
    expect(stored?.state).not.toHaveProperty('signupInfo');
  });

  it('starts idle even when an older install saved "pending"', async () => {
    // What a build from before this fix left behind.
    await storage().setItem(storageKey(), {
      state: {
        users: [],
        loginInfo: { status: Status.PENDING },
        signupInfo: { status: Status.PENDING },
      },
      version: 0,
    });

    await useUserStore.persist.rehydrate();

    expect(useUserStore.getState().loginInfo.status).toBe(Status.IDLE);
  });

  it('still restores everything else', async () => {
    await storage().setItem(storageKey(), {
      state: {
        users: [{ userId: 'user-1', username: 'eli', selected: false }],
        loginInfo: { status: Status.PENDING },
      },
      version: 0,
    });

    await useUserStore.persist.rehydrate();

    expect(useUserStore.getState().users.map(user => user.userId)).toEqual(['user-1']);
  });
});
