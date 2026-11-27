/// <reference types="jest" />

import { AccountSwitchedError, whileAccountSelected } from '@/lib/whileAccountSelected';

/** A minimal selected-account store: `select` switches and notifies, like the user store. */
const accounts = (initial: string | undefined) => {
  let selected = initial;
  const listeners = new Set<() => void>();
  return {
    store: {
      selectedId: () => selected,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    select: (id: string | undefined) => {
      selected = id;
      listeners.forEach(listener => listener());
    },
    listenerCount: () => listeners.size,
  };
};

describe('whileAccountSelected', () => {
  it('returns the result when the account stays selected', async () => {
    const { store, listenerCount } = accounts('alice');
    await expect(whileAccountSelected('alice', store, async () => '0xdeposit')).resolves.toBe(
      '0xdeposit',
    );
    expect(listenerCount()).toBe(0);
  });

  it('refuses to start when another account is selected', async () => {
    const { store } = accounts('bob');
    const request = jest.fn(async () => '0xdeposit');
    await expect(whileAccountSelected('alice', store, request)).rejects.toBeInstanceOf(
      AccountSwitchedError,
    );
    expect(request).not.toHaveBeenCalled();
  });

  // The request may have been sent as Bob while Bob was selected, even though Alice is back.
  it('fails when the selection changes mid-request, even if it switches back', async () => {
    const { store, select, listenerCount } = accounts('alice');
    const result = whileAccountSelected('alice', store, async () => {
      select('bob');
      select('alice');
      return '0xdeposit';
    });
    await expect(result).rejects.toBeInstanceOf(AccountSwitchedError);
    expect(listenerCount()).toBe(0);
  });

  it('ignores store changes that leave the same account selected', async () => {
    const { store, select } = accounts('alice');
    await expect(
      whileAccountSelected('alice', store, async () => {
        select('alice');
        return '0xdeposit';
      }),
    ).resolves.toBe('0xdeposit');
  });
});
