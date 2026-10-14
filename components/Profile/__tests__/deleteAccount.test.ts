import {
  DELETE_ACCOUNT_FOOTNOTE,
  DeleteAccountCheckInput,
  getDeleteAccountChecks,
  getDeleteSheetSubtitle,
} from '@/components/Profile/deleteAccount';

// The real barrel pulls in wagmi, which jest cannot parse; only the formatter is used.
jest.mock('@/lib/utils', () => ({
  formatBalanceUSD: (value: number) =>
    `$${new Intl.NumberFormat('en-us', { minimumFractionDigits: 2 }).format(value)}`,
}));

const settled: DeleteAccountCheckInput = {
  balanceUsd: 0,
  isBalanceLoading: false,
  isBalanceComplete: true,
  hasCard: true,
  pendingCardPayments: 0,
  isCardPaymentsLoading: false,
};

const stateOf = (input: DeleteAccountCheckInput, id: string) =>
  getDeleteAccountChecks(input).checks.find(check => check.id === id)?.state;

describe('getDeleteAccountChecks', () => {
  it('allows deletion once the balance is gone and nothing is pending', () => {
    const { checks, canDelete } = getDeleteAccountChecks(settled);

    expect(canDelete).toBe(true);
    expect(checks.map(check => [check.id, check.state])).toEqual([
      ['balance', 'ok'],
      ['card-payments', 'ok'],
      ['card', 'info'],
    ]);
  });

  it('blocks while money is left and says how much', () => {
    const { checks, canDelete } = getDeleteAccountChecks({ ...settled, balanceUsd: 1284.5 });

    expect(canDelete).toBe(false);
    expect(checks[0]).toMatchObject({
      state: 'blocked',
      title: 'Withdraw your balance',
      detail: '$1,284.50 is still in your account',
      hasAction: true,
    });
  });

  it('treats dust as nothing left', () => {
    expect(stateOf({ ...settled, balanceUsd: 0.42 }, 'balance')).toBe('ok');
    expect(getDeleteAccountChecks({ ...settled, balanceUsd: 0.42 }).canDelete).toBe(true);
  });

  it('still blocks on a known balance when some of it could not be read', () => {
    expect(stateOf({ ...settled, balanceUsd: 50, isBalanceComplete: false }, 'balance')).toBe(
      'blocked',
    );
  });

  it('warns but does not block when the balance cannot be checked', () => {
    const { checks, canDelete } = getDeleteAccountChecks({ ...settled, balanceUsd: undefined });

    expect(checks[0].state).toBe('unknown');
    expect(canDelete).toBe(true);
  });

  it('waits for both checks to load', () => {
    expect(getDeleteAccountChecks({ ...settled, isBalanceLoading: true }).canDelete).toBe(false);
    expect(getDeleteAccountChecks({ ...settled, isCardPaymentsLoading: true }).canDelete).toBe(
      false,
    );
  });

  it('blocks while card payments are pending', () => {
    const { checks, canDelete } = getDeleteAccountChecks({ ...settled, pendingCardPayments: 2 });

    expect(canDelete).toBe(false);
    expect(checks[1]).toMatchObject({ state: 'blocked', detail: '2 payments still pending' });
  });

  it('leaves the card checks out for someone without a card', () => {
    const { checks } = getDeleteAccountChecks({
      ...settled,
      hasCard: false,
      pendingCardPayments: undefined,
    });

    expect(checks.map(check => check.id)).toEqual(['balance']);
  });
});

describe('deletion copy', () => {
  // Deletion is immediate on the backend today; promising a window would be false.
  it('does not promise a grace period', () => {
    expect(getDeleteSheetSubtitle(true)).toBe(
      "This closes your account and cancels your card. It happens straight away and can't be undone.",
    );
    expect(getDeleteSheetSubtitle(false)).toBe(
      "This closes your account. It happens straight away and can't be undone.",
    );
    expect(DELETE_ACCOUNT_FOOTNOTE).not.toMatch(/days/);
  });
});
