import { buildCardSteps } from '@/hooks/useCardSteps/stepHelpers';
import { CardProvider, KycStatus, RainApplicationStatus } from '@/lib/types';

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

/**
 * The gate is a money decision — ~$1 for the identity check and ~$2.50 for the
 * issuer's KYC per applicant — so these cover what the applicant is asked for
 * and in what order, not the copy.
 */
describe('buildCardSteps - minimum-deposit step', () => {
  it('omits the deposit step for an applicant the backend does not gate', () => {
    // Wirex and the deprecated bridge.xyz card, whichever country they are in.
    const steps = build({ options: { depositRequired: false } });

    expect(steps.map(s => s.key)).toEqual(['kyc', 'activate', 'spend']);
    expect(steps.map(s => s.id)).toEqual([1, 2, 3]);
  });

  it('places the deposit step FIRST, ahead of KYC and activation', () => {
    const steps = build({ options: { depositRequired: true } });

    expect(steps.map(s => s.key)).toEqual(['deposit', 'kyc', 'activate', 'spend']);
    expect(steps[0].title).toBe('Deposit at least $10');
    // Numbered by position so the indicator shows 1..4 sequentially.
    expect(steps.map(s => s.id)).toEqual([1, 2, 3, 4]);
  });

  it('renders the minimum the backend serves rather than the built-in default', () => {
    // The bar can move without an app release, so the copy has to follow it.
    const steps = build({ options: { depositRequired: true, minimumDepositUsd: 25 } });

    expect(steps[0].title).toBe('Deposit at least $25');
    expect(steps[0].description).toContain('$25');
  });

  it('gates KYC behind the deposit: deposit precedes KYC and is incomplete when unmet', () => {
    const steps = build({ options: { depositRequired: true, savingsDepositMet: false } });

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
      options: { depositRequired: true, savingsDepositMet: false, openSavingsDepositModal },
    });
    const deposit = steps[0];

    expect(deposit.completed).toBe(false);
    expect(deposit.buttonText).toBe('Deposit');
    expect(deposit.onPress).toBe(openSavingsDepositModal);
  });

  it('marks the deposit step complete once the savings minimum is met', () => {
    const openSavingsDepositModal = jest.fn();
    const steps = build({
      options: { depositRequired: true, savingsDepositMet: true, openSavingsDepositModal },
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
      options: { depositRequired: true, savingsDepositMet: false },
    });

    expect(steps[0].key).toBe('deposit');
    expect(steps[0].completed).toBe(true);
  });

  it('treats legacy card-collateral funding as satisfying the deposit', () => {
    const steps = build({
      options: { depositRequired: true, savingsDepositMet: false, cardCollateralDeposited: 1000 },
    });

    expect(steps[0].completed).toBe(true);
  });
});

/**
 * The applicant deposited, cleared step one, then sent or withdrew the money
 * before their verification came back — so the application was never submitted
 * and we have not been charged for it. This step is how they get it moving
 * again, and its button is what submits.
 */
describe('buildCardSteps - deposit-and-hold step', () => {
  const parked = (options?: Options) =>
    build({
      options: {
        depositRequired: true,
        rainForwardPendingDeposit: true,
        // The application was never sent, so there is no issuer decision.
        rainApplicationStatus: undefined,
        kycStatus: KycStatus.INCOMPLETE,
        ...options,
      },
    });

  it('appears between KYC and activation when the application is parked', () => {
    const steps = parked();

    expect(steps.map(s => s.key)).toEqual(['deposit', 'kyc', 'hold', 'activate', 'spend']);
    expect(steps.map(s => s.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not appear for an applicant who is not gated at all', () => {
    // A Wirex applicant has no such hand-off to park.
    const steps = build({
      options: { depositRequired: false, rainForwardPendingDeposit: true },
    });

    expect(steps.some(s => s.key === 'hold')).toBe(false);
  });

  it('shows the ID check as done and offers no way to restart it', () => {
    // Restarting verification here would burn a second ~$1 session for someone
    // whose first one passed — and read as "your ID check failed", which it did
    // not.
    const [, kyc] = parked();

    expect(kyc.key).toBe('kyc');
    expect(kyc.completed).toBe(true);
    expect(kyc.buttonText).toBeUndefined();
    expect(kyc.onPress).toBeUndefined();
  });

  it('leaves the first deposit step complete so both steps do not ask at once', () => {
    // Reaching the parked state proves the first step was cleared — nothing gets
    // a verification session without passing the gate server-side. A reopened
    // first step would ask for the same deposit twice AND disable this step's
    // button, since navigation requires every preceding step to be complete.
    const steps = parked({ savingsDepositMet: false });

    expect(steps[0].key).toBe('deposit');
    expect(steps[0].completed).toBe(true);
  });

  it('asks for a deposit while the applicant is still short', () => {
    const openSavingsDepositModal = jest.fn();
    const submitPendingApplication = jest.fn();

    const hold = parked({
      savingsDepositMet: false,
      openSavingsDepositModal,
      submitPendingApplication,
    }).find(s => s.key === 'hold');

    expect(hold?.buttonText).toBe('Deposit');
    expect(hold?.onPress).toBe(openSavingsDepositModal);
    expect(submitPendingApplication).not.toHaveBeenCalled();
  });

  it('offers to submit the application once the balance is back', () => {
    const submitPendingApplication = jest.fn();

    const hold = parked({ savingsDepositMet: true, submitPendingApplication }).find(
      s => s.key === 'hold',
    );

    expect(hold?.buttonText).toBe('Submit application');
    expect(hold?.onPress).toBe(submitPendingApplication);
  });

  it('never reads as complete, so activation cannot open behind an unsent application', () => {
    const steps = parked({ savingsDepositMet: true });
    const hold = steps.find(s => s.key === 'hold');
    const activate = steps.find(s => s.key === 'activate');

    expect(hold?.completed).toBe(false);
    // Sequential navigation keys off `completed`, so an incomplete hold step is
    // what keeps "Activate card" shut until the issuer has actually approved.
    expect(activate?.buttonText).toBeUndefined();
    expect(activate?.onPress).toBeUndefined();
  });

  it('marks the action busy while the submission is in flight', () => {
    const hold = parked({
      savingsDepositMet: true,
      isSubmittingPendingApplication: true,
    }).find(s => s.key === 'hold');

    expect(hold?.isLoading).toBe(true);
  });

  it('disappears once the application has been submitted', () => {
    // The backend clears the flag as the submission lands, so an approved
    // applicant never sees this step again.
    const steps = build({
      options: {
        depositRequired: true,
        rainForwardPendingDeposit: false,
        savingsDepositMet: true,
      },
    });

    expect(steps.map(s => s.key)).toEqual(['deposit', 'kyc', 'activate', 'spend']);
  });
});
