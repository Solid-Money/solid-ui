/// <reference types="jest" />

import * as Sentry from '@sentry/react-native';

import { getSentryUser, installSentryUserSync } from '@/lib/telemetry/sentryUser';
import { useUserStore } from '@/store/useUserStore';

import type { User } from '@/lib/types';

jest.mock('@sentry/react-native', () => ({ setUser: jest.fn() }));
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  },
}));

const mockSetUser = Sentry.setUser as jest.Mock;

const user = (overrides: Partial<User>): User =>
  ({
    username: 'alice',
    userId: 'mongo-id-1',
    suborgId: 'turnkey-suborg-1',
    safeAddress: '0x0000000000000000000000000000000000000001',
    signWith: 'passkey',
    selected: false,
    email: 'alice@example.com',
    ...overrides,
  }) as User;

describe('installSentryUserSync', () => {
  it('follows the selected user by backend id and username, never suborg or email', () => {
    useUserStore.setState({ users: [user({ selected: true })] });
    installSentryUserSync();

    expect(mockSetUser).toHaveBeenLastCalledWith({ id: 'mongo-id-1', username: 'alice' });
    expect(getSentryUser()).toEqual({ id: 'mongo-id-1', username: 'alice' });

    // Switching accounts
    useUserStore.setState({
      users: [user({}), user({ userId: 'mongo-id-2', username: 'bob', selected: true })],
    });
    expect(mockSetUser).toHaveBeenLastCalledWith({ id: 'mongo-id-2', username: 'bob' });

    // An unrelated store update does not re-send the same user
    const calls = mockSetUser.mock.calls.length;
    useUserStore.setState({ redirectFrom: '/card' });
    expect(mockSetUser.mock.calls.length).toBe(calls);

    // Logging out
    useUserStore.getState().unselectUser();
    expect(mockSetUser).toHaveBeenLastCalledWith(null);
    expect(getSentryUser()).toBeNull();
  });
});
