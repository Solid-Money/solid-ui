/// <reference types="jest" />

import { User } from '@/lib/types';
import { selectLastKnownIdentity, useUserStore } from '@/store/useUserStore';

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

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    userId: 'user-1',
    username: 'frank.crypto2121',
    email: 'frank.crypto2121@gmail.com',
    safeAddress: '0x07853745fea7396242C999Bc7bCcD8F64d387875',
    signWith: '0xBc82DaA01eBe5360C2eeD6d64C004A4db868DA22',
    suborgId: '13a64832-98d3-4e88-ba08-c7b67908866f',
    selected: false,
    ...overrides,
  }) as User;

const setUsers = (users: User[]) => useUserStore.setState({ users });
const identity = () => selectLastKnownIdentity(useUserStore.getState());

afterEach(() => setUsers([]));

/**
 * What the recovery screen prefills its first field with.
 *
 * The user this came from opened that screen twice on a phone, sat on the empty
 * field both times, and left without typing anything — so the value it starts
 * with is the whole feature, not a convenience.
 */
describe('selectLastKnownIdentity', () => {
  it('offers the email of the account this device was signed into', () => {
    setUsers([buildUser()]);
    expect(identity()).toBe('frank.crypto2121@gmail.com');
  });

  it('survives a logout, which is when it is actually needed', () => {
    // Logging out and a session expiring both clear `selected` and the tokens
    // but leave the row — only "Forget all users" removes it.
    setUsers([buildUser({ selected: false, tokens: undefined })]);
    expect(identity()).toBe('frank.crypto2121@gmail.com');
  });

  it('prefers the account that was selected over the others', () => {
    setUsers([
      buildUser({ userId: 'other', email: 'other@example.com' }),
      buildUser({ userId: 'user-1', selected: true }),
    ]);
    expect(identity()).toBe('frank.crypto2121@gmail.com');
  });

  it('falls back to the username for an account carrying no email', () => {
    // Roughly one account in ten. Recovery now takes a username, so this is a
    // usable prefill rather than a blank field.
    setUsers([buildUser({ email: undefined })]);
    expect(identity()).toBe('frank.crypto2121');
  });

  it('skips a row that has neither, rather than offering an empty string', () => {
    setUsers([
      buildUser({ userId: 'blank', email: undefined, username: undefined }),
      buildUser({ userId: 'user-1' }),
    ]);
    expect(identity()).toBe('frank.crypto2121@gmail.com');
  });

  it('trims what it offers, so a stray space cannot fail validation', () => {
    setUsers([buildUser({ email: '  frank.crypto2121@gmail.com  ' })]);
    expect(identity()).toBe('frank.crypto2121@gmail.com');
  });

  it('offers nothing on a device that has never signed in', () => {
    setUsers([]);
    expect(identity()).toBe('');
  });
});
