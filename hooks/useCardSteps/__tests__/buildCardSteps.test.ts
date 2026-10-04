import { EndorsementStatus } from '@/components/BankTransfer/enums';
import { buildCardSteps } from '@/hooks/useCardSteps/stepHelpers';
import {
  BridgeCustomerEndorsement,
  CardProvider,
  KycStatus,
  RainApplicationStatus,
} from '@/lib/types';

const noop = () => {};

type Options = Parameters<typeof buildCardSteps>[7];

const build = ({
  cardActivated = false,
  activationBlocked,
  options,
}: {
  cardActivated?: boolean;
  activationBlocked?: boolean;
  options?: Options;
} = {}) =>
  buildCardSteps(
    undefined, // cardsEndorsement
    undefined, // customerRejectionReasons
    cardActivated,
    activationBlocked,
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

  it('places the setup-fee step FIRST, ahead of KYC and activation', () => {
    const steps = build({ options: { depositRequired: true } });

    expect(steps.map(s => s.key)).toEqual(['deposit', 'kyc', 'activate', 'spend']);
    expect(steps[0].title).toBe('Pay the $10 setup fee');
    // Numbered by position so the indicator shows 1..4 sequentially.
    expect(steps.map(s => s.id)).toEqual([1, 2, 3, 4]);
  });

  it('renders the fee the backend serves rather than the built-in default', () => {
    // The charge is configured per country and can move without an app
    // release, so the copy has to follow it.
    const steps = build({ options: { depositRequired: true, minimumDepositUsd: 25 } });

    expect(steps[0].title).toBe('Pay the $25 setup fee');
    expect(steps[0].description).toContain('$25');
  });

  it('gates KYC behind the fee: it precedes KYC and is incomplete when unpaid', () => {
    const steps = build({ options: { depositRequired: true, onboardingFeePaid: false } });

    const depositIndex = steps.findIndex(s => s.key === 'deposit');
    const kycIndex = steps.findIndex(s => s.key === 'kyc');
    // Sequential step navigation only enables a step once all preceding steps
    // are complete, so an incomplete first step blocks KYC's button.
    expect(depositIndex).toBeLessThan(kycIndex);
    expect(steps[depositIndex].completed).toBe(false);
  });

  it('offers the fee sheet while the fee is unpaid', () => {
    const openFeeSheet = jest.fn();

    const steps = build({
      cardActivated: false,
      options: { depositRequired: true, onboardingFeePaid: false, openFeeSheet },
    });
    const deposit = steps[0];

    expect(deposit.completed).toBe(false);
    expect(deposit.buttonText).toBe('Pay $10');
    expect(deposit.onPress).toBe(openFeeSheet);
  });

  it('marks the step complete once the fee is settled', () => {
    const openFeeSheet = jest.fn();
    const steps = build({
      options: { depositRequired: true, onboardingFeePaid: true, openFeeSheet },
    });
    const deposit = steps[0];

    expect(deposit.completed).toBe(true);
    expect(deposit.status).toBe('completed');
    // No further action needed once paid.
    expect(deposit.buttonText).toBeUndefined();
    expect(deposit.onPress).toBeUndefined();
  });

  it('keeps the step complete after the card is activated', () => {
    // Once a card exists the user has cleared the gate, so the step must not
    // reopen on a status response that has not caught up.
    const steps = build({
      cardActivated: true,
      options: { depositRequired: true, onboardingFeePaid: false },
    });

    expect(steps[0].key).toBe('deposit');
    expect(steps[0].completed).toBe(true);
  });

  it('treats legacy card-collateral funding as satisfying the fee', () => {
    const steps = build({
      options: { depositRequired: true, onboardingFeePaid: false, cardCollateralDeposited: 1000 },
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

  it('leaves the first fee step complete so both steps do not ask at once', () => {
    // Reaching the parked state proves the first step was cleared — nothing gets
    // a verification session without passing the gate server-side. A reopened
    // first step would ask for the same fee twice AND disable this step's
    // button, since navigation requires every preceding step to be complete.
    const steps = parked({ onboardingFeePaid: false });

    expect(steps[0].key).toBe('deposit');
    expect(steps[0].completed).toBe(true);
  });

  it('asks for the fee while it is still outstanding', () => {
    const openFeeSheet = jest.fn();
    const submitPendingApplication = jest.fn();

    const hold = parked({
      onboardingFeePaid: false,
      openFeeSheet,
      submitPendingApplication,
    }).find(s => s.key === 'hold');

    expect(hold?.buttonText).toBe('Pay $10');
    expect(hold?.onPress).toBe(openFeeSheet);
    expect(submitPendingApplication).not.toHaveBeenCalled();
  });

  it('offers to submit the application once the fee is paid', () => {
    const submitPendingApplication = jest.fn();

    const hold = parked({ onboardingFeePaid: true, submitPendingApplication }).find(
      s => s.key === 'hold',
    );

    expect(hold?.buttonText).toBe('Submit application');
    expect(hold?.onPress).toBe(submitPendingApplication);
  });

  it('never reads as complete, so activation cannot open behind an unsent application', () => {
    const steps = parked({ onboardingFeePaid: true });
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
      onboardingFeePaid: true,
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
        onboardingFeePaid: true,
      },
    });

    expect(steps.map(s => s.key)).toEqual(['deposit', 'kyc', 'activate', 'spend']);
  });
});

describe('buildCardSteps - a blocked activation', () => {
  it('does not repeat the failure reason in the step description', () => {
    // CardStatusBanner renders the reason directly above this list, and
    // useStepNavigation auto-expands the first incomplete step — the activate
    // step — so carrying the reason here showed it twice on first paint.
    const activate = build({
      activationBlocked: true,
      options: { depositRequired: false, kycStatus: KycStatus.APPROVED },
    }).find(s => s.key === 'activate');

    expect(activate?.description).toBe(
      'On hold — see the message above for what happened and what to do next.',
    );
  });

  it('withdraws the activate action, so the button cannot reproduce the failure', () => {
    const activate = build({
      activationBlocked: true,
      options: { depositRequired: false, kycStatus: KycStatus.APPROVED },
    }).find(s => s.key === 'activate');

    expect(activate?.buttonText).toBeUndefined();
    expect(activate?.onPress).toBeUndefined();
  });

  it('still offers the action when nothing is blocking', () => {
    const activate = build({
      options: { depositRequired: false, kycStatus: KycStatus.APPROVED },
    }).find(s => s.key === 'activate');

    expect(activate?.buttonText).toBe('Activate card');
    expect(activate?.onPress).toBeDefined();
  });
});

describe('buildCardSteps - a retired Bridge endorsement', () => {
  // An old bridge.xyz customer keeps their "cards" endorsement on Bridge's side.
  const approvedBridgeEndorsement = {
    name: 'cards',
    status: EndorsementStatus.APPROVED,
  } as unknown as BridgeCustomerEndorsement;

  const kycStepFor = (kycStatus?: KycStatus) =>
    buildCardSteps(approvedBridgeEndorsement, undefined, false, undefined, noop, noop, noop, {
      cardIssuer: CardProvider.WIREX,
      kycStatus,
      depositRequired: false,
    }).find(s => s.key === 'kyc');

  it('does not complete KYC for a Wirex applicant who has not verified', () => {
    // The backend reports a card customer, so its kycStatus is the answer —
    // the Bridge approval is for a card that no longer exists.
    const kyc = kycStepFor(KycStatus.NOT_STARTED);

    expect(kyc?.completed).toBe(false);
    expect(kyc?.buttonText).toBe('Continue verification');
    expect(kyc?.onPress).toBeDefined();
  });

  it('still honours the endorsement for a Bridge-only user with no card customer', () => {
    const kyc = kycStepFor(undefined);

    expect(kyc?.completed).toBe(true);
  });
});
