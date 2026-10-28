/// <reference types="jest" />

import {
  CardProvider,
  CardStatus,
  CardStatusResponse,
  KycStatus,
  RainApplicationStatus,
} from '@/lib/types';
import {
  describeResubmission,
  hasOpenedWirexCheck,
  isWirexOnboarding,
  resolveWirexOnboardingStep,
  suggestedCardCurrency,
} from '@/lib/utils/wirexOnboarding';

const wirex = (overrides: Partial<CardStatusResponse> = {}): CardStatusResponse => ({
  provider: CardProvider.WIREX,
  ...overrides,
});

describe('isWirexOnboarding', () => {
  it('takes a Wirex applicant without a card', () => {
    expect(isWirexOnboarding(wirex({ kycStatus: KycStatus.UNDER_REVIEW }))).toBe(true);
  });

  it('takes a new user the routing says Wirex will serve, before /cards/status can', () => {
    expect(isWirexOnboarding(null, CardProvider.WIREX)).toBe(true);
  });

  it('leaves a Rain applicant on the existing screens', () => {
    expect(isWirexOnboarding({ provider: CardProvider.RAIN }, CardProvider.WIREX)).toBe(false);
    expect(isWirexOnboarding(null, CardProvider.RAIN)).toBe(false);
    expect(
      isWirexOnboarding(wirex({ rainApplicationStatus: RainApplicationStatus.NEEDS_VERIFICATION })),
    ).toBe(false);
  });

  it('leaves an issuer nobody has named yet on the existing screens', () => {
    expect(isWirexOnboarding(null, null)).toBe(false);
  });

  it('never moves an existing cardholder', () => {
    expect(isWirexOnboarding(wirex({ status: CardStatus.ACTIVE }))).toBe(false);
    expect(isWirexOnboarding(wirex({ status: CardStatus.FROZEN }))).toBe(false);
    // A closed card is replaced from the existing issuance screen.
    expect(isWirexOnboarding(wirex({ status: CardStatus.INACTIVE, canRequestNewCard: true }))).toBe(
      false,
    );
  });

  it('keeps a card being created in the flow, so the Activating screen can show', () => {
    expect(isWirexOnboarding(wirex({ status: CardStatus.PENDING }))).toBe(true);
  });
});

describe('resolveWirexOnboardingStep', () => {
  it.each([
    ['nothing at all', null, 'verify'],
    ['not started', wirex({ kycStatus: KycStatus.NOT_STARTED }), 'verify'],
    ['under review', wirex({ kycStatus: KycStatus.UNDER_REVIEW }), 'checking'],
    ['paused', wirex({ kycStatus: KycStatus.PAUSED }), 'checking'],
    ['approved', wirex({ kycStatus: KycStatus.APPROVED }), 'approved'],
    ['rejected', wirex({ kycStatus: KycStatus.REJECTED }), 'declined'],
    ['offboarded', wirex({ kycStatus: KycStatus.OFFBOARDED }), 'declined'],
    [
      'a resubmission',
      wirex({ kycStatus: KycStatus.INCOMPLETE, kycRejectType: 'RETRY' }),
      'more-documents',
    ],
    [
      'a card being opened',
      wirex({ kycStatus: KycStatus.APPROVED, status: CardStatus.PENDING }),
      'creating',
    ],
  ] as const)('%s → %s', (_label, cardStatus, step) => {
    expect(resolveWirexOnboardingStep(cardStatus)).toBe(step);
  });

  it('sends a failed issuance to its own screen rather than back to Approved', () => {
    expect(
      resolveWirexOnboardingStep(
        wirex({
          kycStatus: KycStatus.APPROVED,
          activationFailure: { code: 'COUNTRY_NOT_SUPPORTED', reason: 'x', terminal: true },
        }),
      ),
    ).toBe('activation-failed');
    expect(
      resolveWirexOnboardingStep(wirex({ kycStatus: KycStatus.APPROVED, activationBlocked: true })),
    ).toBe('activation-failed');
  });

  it('does not ask for documents when the hand-off to Wirex failed on our side', () => {
    // Re-opening Sumsub here finds a check that already passed and loops back.
    expect(
      resolveWirexOnboardingStep(
        wirex({
          kycStatus: KycStatus.INCOMPLETE,
          kycWarnings: [{ risk: 'CARD_ACTIVATION_FAILED', short_description: 'Wirex failed' }],
        }),
      ),
    ).toBe('support');
  });

  it('still asks for documents on a resubmission that also carries an old hand-off note', () => {
    expect(
      resolveWirexOnboardingStep(
        wirex({
          kycStatus: KycStatus.INCOMPLETE,
          kycRejectType: 'RETRY',
          kycWarnings: [{ risk: 'CARD_ACTIVATION_FAILED' }, { risk: 'BAD_PROOF_OF_ADDRESS' }],
        }),
      ),
    ).toBe('more-documents');
  });
});

describe('suggestedCardCurrency', () => {
  it.each([
    ['DE', 'EUR'],
    ['fr', 'EUR'],
    [' NL ', 'EUR'],
    ['BG', 'EUR'],
    ['MC', 'EUR'],
    ['GB', 'USD'],
    ['PL', 'USD'],
    ['US', 'USD'],
    [undefined, 'USD'],
    [null, 'USD'],
  ] as const)('%s → %s', (country, currency) => {
    expect(suggestedCardCurrency(country)).toBe(currency);
  });
});

describe('describeResubmission', () => {
  it('names proof of address in plain words', () => {
    expect(describeResubmission([{ risk: 'BAD_PROOF_OF_ADDRESS' }])).toEqual({
      title: 'We need one more document',
      body: expect.stringMatching(/proof of address wasn’t accepted/),
    });
  });

  it('groups document-quality labels under the ID', () => {
    expect(
      describeResubmission([{ risk: 'UNSATISFACTORY_PHOTOS' }, { risk: 'SCREENSHOTS' }]).title,
    ).toBe('We need a clearer photo of your ID');
  });

  it('asks for a few more details when more than one thing is wrong', () => {
    const { title, body } = describeResubmission([
      { risk: 'BAD_PROOF_OF_ADDRESS' },
      { risk: 'BAD_SELFIE' },
    ]);
    expect(title).toBe('We need a few more details');
    expect(body).toMatch(/proof of address/);
    expect(body).toMatch(/selfie/);
  });

  it('falls back to the backend description for a label it does not word itself', () => {
    expect(
      describeResubmission([
        {
          risk: 'INCOMPATIBLE_LANGUAGE',
          short_description: 'A certified translation is required.',
        },
      ]).body,
    ).toBe('A certified translation is required.');
  });

  it('never repeats a compliance label back to the applicant', () => {
    const { body } = describeResubmission([
      { risk: 'PEP', short_description: 'You were flagged as a politically exposed person.' },
      { risk: 'SANCTIONS', short_description: 'You were flagged on a sanctions list.' },
    ]);
    expect(body).not.toMatch(/politically exposed|sanctions/);
  });

  it('has something to say with no warnings at all', () => {
    expect(describeResubmission(undefined).title).toBeTruthy();
    expect(describeResubmission([]).body).toBeTruthy();
  });
});

describe('hasOpenedWirexCheck', () => {
  it('is true once Sumsub reports the applicant', () => {
    expect(hasOpenedWirexCheck(wirex({ kycReviewStatus: 'init' }))).toBe(true);
  });

  it('is false before the check was opened', () => {
    expect(hasOpenedWirexCheck(wirex({ kycStatus: KycStatus.NOT_STARTED }))).toBe(false);
    expect(hasOpenedWirexCheck(null)).toBe(false);
  });
});
