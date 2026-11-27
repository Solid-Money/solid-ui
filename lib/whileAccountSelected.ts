/** The account changed under a request that authenticates as whichever account is selected. */
export class AccountSwitchedError extends Error {
  constructor() {
    super('Your account changed while this was in progress. Nothing was moved. Please try again.');
    this.name = 'AccountSwitchedError';
  }
}

/**
 * Runs `request` only while `accountId` stays the selected account, start to finish.
 *
 * API calls authenticate as the account selected when they are sent (its token on native, the
 * session cookie on web), and a request can wait before sending (a token refresh), so a check
 * before the call alone is not enough. Any change of selection while it runs (even one that
 * switches back) fails it, because the request may have gone out as the other account.
 */
export const whileAccountSelected = async <T>(
  accountId: string,
  store: {
    selectedId: () => string | undefined;
    /** Calls `listener` on every change; returns the unsubscribe. */
    subscribe: (listener: () => void) => () => void;
  },
  request: () => Promise<T>,
): Promise<T> => {
  if (store.selectedId() !== accountId) throw new AccountSwitchedError();

  let switched = false;
  const unsubscribe = store.subscribe(() => {
    if (store.selectedId() !== accountId) switched = true;
  });
  try {
    const result = await request();
    if (switched || store.selectedId() !== accountId) throw new AccountSwitchedError();
    return result;
  } finally {
    unsubscribe();
  }
};
