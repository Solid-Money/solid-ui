import { buildCardSteps } from '@/hooks/useCardSteps/stepHelpers';
import { CardProvider, RainApplicationStatus } from '@/lib/types';

// Keep the import light: stepHelpers only pulls these two helpers from the
// (heavy) utils barrel, so we stub them with the real logic. jest.mock is
// hoisted above the imports above, so stepHelpers sees the stub.
jest.mock('@/lib/utils', () => ({
  requiresCardDeposit: (country?: string | null) => country?.toUpperCase() === 'BD',
  hasMetCardDeposit: (cents?: number | null) => (cents ?? 0) >= 500,
}));

const noop = () => {};

type Options = Parameters<typeof buildCardSteps>[8];

const build = ({
  cardActivated = false,
  options,
}: {
  cardActivated?: boolean;
  options?: Options;
} = {}) =>
  buildCardSteps(
    undefined, // cardsEndorsement
    undefined, // customerRejectionReasons
    cardActivated,
    undefined, // activationBlocked
    undefined, // activationBlockedReason
    noop, // handleProceedToKyc
    noop, // pushCardReady
    noop, // pushCardDetails
    {
      cardIssuer: CardProvider.RAIN,
      rainApplicationStatus: RainApplicationStatus.APPROVED,
      ...options,
    },
  );

describe('buildCardSteps - Bangladesh deposit-first step', () => {
  it('does not add the deposit step for non-BD users', () => {
    const steps = build({ options: { country: 'US' } });

    expect(steps.map(s => s.key)).toEqual(['kyc', 'activate', 'spend']);
    expect(steps.map(s => s.title)).toEqual([
      'Complete KYC',
      'Activate your card',
      'Start spending :)',
    ]);
    expect(steps.map(s => s.id)).toEqual([1, 2, 3]);
  });

  it('places the deposit step FIRST for BD users, ahead of KYC and activation', () => {
    const steps = build({ options: { country: 'BD' } });

    expect(steps.map(s => s.key)).toEqual(['deposit', 'kyc', 'activate', 'spend']);
    expect(steps[0].title).toBe('Deposit at least $5');
    // Numbered by position so the indicator shows 1..4 sequentially.
    expect(steps.map(s => s.id)).toEqual([1, 2, 3, 4]);
  });

  it('gates KYC behind the deposit: deposit precedes KYC and is incomplete when unmet', () => {
    const steps = build({ options: { country: 'BD', savingsDepositMet: false } });

    const depositIndex = steps.findIndex(s => s.key === 'deposit');
    const kycIndex = steps.findIndex(s => s.key === 'kyc');
    // Sequential step navigation only enables a step once all preceding steps
    // are complete, so an incomplete first step blocks KYC's button.
    expect(depositIndex).toBeLessThan(kycIndex);
    expect(steps[depositIndex].completed).toBe(false);
  });

  it('offers the savings-deposit action immediately (no card required) when unmet', () => {
    const openSavingsDepositModal = jest.fn();

    const steps = build({
      cardActivated: false,
      options: { country: 'BD', savingsDepositMet: false, openSavingsDepositModal },
    });
    const deposit = steps[0];

    expect(deposit.completed).toBe(false);
    expect(deposit.buttonText).toBe('Deposit');
    expect(deposit.onPress).toBe(openSavingsDepositModal);
  });

  it('marks the deposit step complete once the savings minimum is met', () => {
    const openSavingsDepositModal = jest.fn();
    const steps = build({
      options: { country: 'BD', savingsDepositMet: true, openSavingsDepositModal },
    });
    const deposit = steps[0];

    expect(deposit.completed).toBe(true);
    expect(deposit.status).toBe('completed');
    // No further action needed once funded.
    expect(deposit.buttonText).toBeUndefined();
    expect(deposit.onPress).toBeUndefined();
  });

  it('keeps the deposit step complete after the card is activated (funds moved to card)', () => {
    // Once a card exists the user has cleared the gate; moving savings onto the
    // card can drop the soUSD balance, but the step must not reopen.
    const steps = build({
      cardActivated: true,
      options: { country: 'BD', savingsDepositMet: false },
    });

    expect(steps[0].key).toBe('deposit');
    expect(steps[0].completed).toBe(true);
  });

  it('treats legacy card-collateral funding as satisfying the deposit', () => {
    const steps = build({
      options: { country: 'BD', savingsDepositMet: false, cardCollateralDeposited: 500 },
    });

    expect(steps[0].completed).toBe(true);
  });
});
