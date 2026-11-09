import { cashbackDebtLine } from '@/lib/referral/referralDebt';

describe('cashbackDebtLine', () => {
  it('says what was reversed and that it comes out of later rewards, not the wallet', () => {
    expect(cashbackDebtLine({ remainingUsd: 25, reversedCount: 1 })).toBe(
      'A reward you were paid was reversed because the qualifying purchases were refunded. $25 will come out of your next referral rewards.',
    );
    expect(cashbackDebtLine({ remainingUsd: 37.5, reversedCount: 2 })).toBe(
      '2 rewards you were paid were reversed because the qualifying purchases were refunded. $37.50 will come out of your next referral rewards.',
    );
  });

  it('shows nothing when nothing is owed, or on an older backend', () => {
    expect(cashbackDebtLine(null)).toBeNull();
    expect(cashbackDebtLine(undefined)).toBeNull();
    expect(cashbackDebtLine({ remainingUsd: 0, reversedCount: 1 })).toBeNull();
  });
});
