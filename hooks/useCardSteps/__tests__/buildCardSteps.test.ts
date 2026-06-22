import { buildCardSteps } from '@/hooks/useCardSteps/stepHelpers';
import { CardProvider, KycStatus, KycWarning, RainApplicationStatus } from '@/lib/types';

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

describe('buildCardSteps - Bangladesh minimum-deposit step', () => {
  it('does not add the deposit step for non-BD users', () => {
    const steps = build({ options: { country: 'US' } });

    expect(steps.map(s => s.title)).toEqual([
      'Complete KYC',
      'Activate your card',
      'Start spending :)',
    ]);
    // Ids stay sequential and the activate step keeps id 2.
    expect(steps.map(s => s.id)).toEqual([1, 2, 3]);
  });

  it('inserts the deposit step after "Activate your card" for BD users', () => {
    const steps = build({ options: { country: 'BD' } });

    expect(steps.map(s => s.title)).toEqual([
      'Complete KYC',
      'Activate your card',
      'Deposit at least $5',
      'Start spending :)',
    ]);
    // Numbered by position so the indicator shows 1..4 and activate stays id 2.
    expect(steps.map(s => s.id)).toEqual([1, 2, 3, 4]);
    expect(steps[1].id).toBe(2); // activate
  });

  it('offers the deposit action only once the card is activated and unfunded', () => {
    const openDepositModal = jest.fn();

    const beforeActivation = build({
      cardActivated: false,
      options: { country: 'BD', cardCollateralDeposited: 0, openDepositModal },
    });
    const depositStepBefore = beforeActivation[2];
    expect(depositStepBefore.completed).toBe(false);
    expect(depositStepBefore.buttonText).toBeUndefined();
    expect(depositStepBefore.onPress).toBeUndefined();

    const afterActivation = build({
      cardActivated: true,
      options: { country: 'BD', cardCollateralDeposited: 300, openDepositModal },
    });
    const depositStepAfter = afterActivation[2];
    expect(depositStepAfter.completed).toBe(false);
    expect(depositStepAfter.buttonText).toBe('Deposit');
    expect(depositStepAfter.onPress).toBe(openDepositModal);
  });

  it('marks the deposit step complete once the $5 minimum is met', () => {
    const openDepositModal = jest.fn();
    const steps = build({
      cardActivated: true,
      options: { country: 'BD', cardCollateralDeposited: 500, openDepositModal },
    });

    const depositStep = steps[2];
    expect(depositStep.completed).toBe(true);
    expect(depositStep.status).toBe('completed');
    // No further action needed once funded.
    expect(depositStep.buttonText).toBeUndefined();
    expect(depositStep.onPress).toBeUndefined();
  });
});

describe('buildCardSteps - Didit→Rain forward failure', () => {
  const warning: KycWarning = {
    risk: 'CARD_ACTIVATION_FAILED',
    short_description:
      "body must have required property 'sumsubShareToken', " +
      "body must have required property 'personaShareToken', " +
      'body/address/line1 must NOT have more than 100 characters, ' +
      'body must match exactly one schema in oneOf',
  };

  it('offers a working "Contact support" action on the KYC step', () => {
    const handleRainKYCPress = jest.fn();
    const steps = build({
      options: {
        cardIssuer: CardProvider.RAIN,
        rainApplicationStatus: RainApplicationStatus.DIDIT_FORWARD_FAILED,
        kycStatus: KycStatus.INCOMPLETE,
        kycWarnings: [warning],
        handleRainKYCPress,
      },
    });

    const kycStep = steps[0];
    expect(kycStep.title).toBe('Complete KYC');
    expect(kycStep.completed).toBe(false);
    // The verification step cannot be completed by the user, so the button
    // routes to support instead of looping them back through verification.
    expect(kycStep.buttonText).toBe('Contact support');
    expect(kycStep.onPress).toBe(handleRainKYCPress);
    // Only the informative clause is displayed — the raw multi-clause noise is hidden.
    expect(kycStep.description).toContain(
      'body/address/line1 must NOT have more than 100 characters',
    );
    expect(kycStep.description).not.toContain('sumsubShareToken');
  });
});
