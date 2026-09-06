import {
  bankBalancesToShow,
  getTotalBalance,
  shouldShowCard,
  shouldShowSpendable,
} from '@/components/Home/NewHome/OtherBalancesDropdown/balanceTotals';

/**
 * The home headline is now every balance added together, which makes one mistake
 * possible that could not happen before: counting the same money twice. A Wirex
 * card's reported balance is spendable soUSD — savings seen from the card's side —
 * so it is not a pot of its own and must not join the sum.
 */
describe('getTotalBalance', () => {
  const balances = {
    walletBalance: 2.03,
    cardBalance: 9.24,
    savingsBalance: 7478.74,
    userHasCard: true,
  };

  it('adds Wallet, Card and Savings for a card that holds its own balance', () => {
    expect(getTotalBalance({ ...balances, cardHoldsOwnBalance: true })).toBeCloseTo(7490.01, 2);
  });

  it('leaves out the card balance when the card holds none of its own', () => {
    // Wirex: the $9.24 is a slice of the $7,478.74, not money beside it.
    expect(getTotalBalance({ ...balances, cardHoldsOwnBalance: false })).toBeCloseTo(7480.77, 2);
  });

  it('counts a prefunded card by default, so a slow issuer query cannot drop it', () => {
    expect(getTotalBalance(balances)).toBeCloseTo(7490.01, 2);
  });

  it('is Wallet + Savings for a user with no card', () => {
    expect(getTotalBalance({ ...balances, userHasCard: false, cardBalance: 0 })).toBeCloseTo(
      7480.77,
      2,
    );
  });

  it('treats missing figures as zero rather than producing NaN', () => {
    expect(
      getTotalBalance({
        walletBalance: undefined as unknown as number,
        cardBalance: undefined as unknown as number,
        savingsBalance: undefined as unknown as number,
        userHasCard: false,
      }),
    ).toBe(0);
  });
});

/**
 * Card and Spendable stand in the same slot and answer the same question for two
 * kinds of card. Both at once would show a $0 Card row beside a funded Spendable
 * one, which reads as money the user had lost.
 */
describe('the Card / Spendable slot', () => {
  it('gives a prefunded cardholder the Card row only', () => {
    const args = { cardBalance: 9.24, userHasCard: true, cardHoldsOwnBalance: true };
    expect(shouldShowCard(args)).toBe(true);
    expect(shouldShowSpendable(args)).toBe(false);
  });

  it('gives a Wirex cardholder the Spendable row only', () => {
    const args = { cardBalance: 9.24, userHasCard: true, cardHoldsOwnBalance: false };
    expect(shouldShowCard(args)).toBe(false);
    expect(shouldShowSpendable(args)).toBe(true);
  });

  it('gives a user with no card neither row', () => {
    const args = { cardBalance: 0, userHasCard: false, cardHoldsOwnBalance: true };
    expect(shouldShowCard(args)).toBe(false);
    expect(shouldShowSpendable(args)).toBe(false);
  });

  // Testers whose card status hasn't flipped to ACTIVE still have a real balance.
  it('still shows a Card row for a balance without an active card', () => {
    expect(shouldShowCard({ cardBalance: 12, userHasCard: false })).toBe(true);
  });
});

/**
 * The Wirex bank balance is the first pot here that is not USD, and the first
 * that Solid cannot move. Both facts keep it out of the headline and give it its
 * own rows.
 */
describe('the Bank rows', () => {
  it('shows a currency the user actually holds', () => {
    expect(bankBalancesToShow([{ tokenSymbol: 'WEUR', amount: 55.93, currency: 'EUR' }])).toEqual([
      { tokenSymbol: 'WEUR', amount: 55.93, currency: 'EUR' },
    ]);
  });

  it('drops a zero rail, so it does not read as money lost', () => {
    // Both rails report a balance once either is provisioned, so a funded EUR
    // row would otherwise sit beside an empty USD one.
    expect(
      bankBalancesToShow([
        { tokenSymbol: 'WEUR', amount: 55.93, currency: 'EUR' },
        { tokenSymbol: 'WUSD', amount: 0, currency: 'USD' },
      ]),
    ).toHaveLength(1);
  });

  it('keeps both when both are funded', () => {
    expect(
      bankBalancesToShow([
        { tokenSymbol: 'WEUR', amount: 10, currency: 'EUR' },
        { tokenSymbol: 'WUSD', amount: 20, currency: 'USD' },
      ]),
    ).toHaveLength(2);
  });

  it('shows nothing for a user with no bank account', () => {
    expect(bankBalancesToShow([])).toEqual([]);
    expect(bankBalancesToShow()).toEqual([]);
  });

  it('drops a non-finite amount rather than rendering NaN', () => {
    expect(
      bankBalancesToShow([{ tokenSymbol: 'WEUR', amount: Number.NaN, currency: 'EUR' }]),
    ).toEqual([]);
  });

  it('never enters the headline total', () => {
    // EUR cannot be added to a USD total without a live rate, and this money is
    // in Wirex's custody — the headline would overstate both the amount and what
    // the user can do from here. The rows say it instead, in its own currency.
    const args = { walletBalance: 100, cardBalance: 0, savingsBalance: 50, userHasCard: false };
    expect(getTotalBalance(args)).toBe(150);
  });
});
