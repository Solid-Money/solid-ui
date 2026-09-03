/// <reference types="jest" />

import { DigitalWalletType } from '@/constants/digital-wallet';
import { KycStatus, RainApplicationStatus } from '@/lib/types';
import { HomePromptStepInput, resolveHomePromptStep } from '@/lib/utils/homePromptStep';

const STARTED_AT = 1_700_000_000_000;

/** A user with a funded card that has never been spent on — the Apple Pay rung. */
const base: HomePromptStepInput = {
  hasCard: true,
  depositCompleted: true,
  cardStatus: {},
  kycStartedAt: null,
  hasSpentOnCard: false,
  isCardSpendResolved: true,
  wallet: DigitalWalletType.Apple,
  // Answered, and the card is in neither wallet.
  eligibility: {},
};

const step = (overrides: Partial<HomePromptStepInput> = {}) =>
  resolveHomePromptStep({ ...base, ...overrides });

describe('resolveHomePromptStep — the pre-card rungs', () => {
  const noCard = { hasCard: false, depositCompleted: false } as const;

  it('offers the card to a user who has never verified', () => {
    expect(step({ ...noCard, cardStatus: null })).toBe('get-card');
    expect(step({ ...noCard, cardStatus: { kycStatus: KycStatus.NOT_STARTED } })).toBe('get-card');
  });

  it('asks a user who abandoned verification to finish it', () => {
    // Nothing on the server yet — the local SDK marker is the only evidence.
    expect(step({ ...noCard, cardStatus: null, kycStartedAt: STARTED_AT })).toBe('verification');
    expect(step({ ...noCard, cardStatus: { kycStatus: KycStatus.INCOMPLETE } })).toBe(
      'verification',
    );
    expect(
      step({
        ...noCard,
        cardStatus: { rainApplicationStatus: RainApplicationStatus.NEEDS_INFORMATION },
      }),
    ).toBe('verification');
  });

  it('tells a user waiting on a decision that the card is on its way', () => {
    expect(step({ ...noCard, cardStatus: { kycStatus: KycStatus.UNDER_REVIEW } })).toBe(
      'kyc-review',
    );
    expect(
      step({
        ...noCard,
        cardStatus: { rainApplicationStatus: RainApplicationStatus.MANUAL_REVIEW },
      }),
    ).toBe('kyc-review');
  });

  it('reports a declined verification', () => {
    expect(step({ ...noCard, cardStatus: { kycStatus: KycStatus.REJECTED } })).toBe('kyc-rejected');
    expect(
      step({ ...noCard, cardStatus: { rainApplicationStatus: RainApplicationStatus.DENIED } }),
    ).toBe('kyc-rejected');
  });

  it('offers activation once verification is approved', () => {
    expect(step({ ...noCard, cardStatus: { kycStatus: KycStatus.APPROVED } })).toBe(
      'activate-card',
    );
    expect(
      step({ ...noCard, cardStatus: { rainApplicationStatus: RainApplicationStatus.APPROVED } }),
    ).toBe('activate-card');
  });

  it('never asks an unverified user to fund, even with no funds', () => {
    // Without a card the next step is the card, not a top-up.
    expect(step({ ...noCard, cardStatus: { kycStatus: KycStatus.NOT_STARTED } })).not.toBe('fund');
  });
});

describe('resolveHomePromptStep — the post-card rungs', () => {
  it('asks an unfunded cardholder to fund the wallet', () => {
    expect(step({ depositCompleted: false })).toBe('fund');
  });

  it('funding outranks everything after it', () => {
    // A card can carry spend from before its balance was drained; the user's
    // next move is still to put money on it.
    expect(step({ depositCompleted: false, hasSpentOnCard: true })).toBe('fund');
  });

  it('offers Apple Pay on iOS once the card is funded and unused', () => {
    expect(step()).toBe('add-to-wallet');
  });

  it('offers Google Wallet on Android', () => {
    expect(step({ wallet: DigitalWalletType.Google })).toBe('add-to-wallet');
  });

  it('checks the wallet this device would actually add to', () => {
    // Already in Apple Wallet, asked on iOS → nothing left to offer.
    expect(
      step({ wallet: DigitalWalletType.Apple, eligibility: { alreadyInAppleWallet: true } }),
    ).toBeNull();
    // …but the same card is not in Google Wallet, so Android still offers it.
    expect(
      step({ wallet: DigitalWalletType.Google, eligibility: { alreadyInAppleWallet: true } }),
    ).toBe('add-to-wallet');
    expect(
      step({ wallet: DigitalWalletType.Google, eligibility: { alreadyInGoogleWallet: true } }),
    ).toBeNull();
  });

  it('says nothing where there is no wallet to add to', () => {
    expect(step({ wallet: null })).toBeNull();
  });

  it('waits for eligibility rather than guessing the card is unprovisioned', () => {
    expect(step({ eligibility: null })).toBeNull();
    expect(step({ eligibility: undefined })).toBeNull();
  });

  it('waits for the card history before offering the wallet nudge', () => {
    // Otherwise a returning cardholder is shown a step they are already past,
    // and watches it swap to the cashback banner a moment later.
    expect(step({ isCardSpendResolved: false })).toBeNull();
  });

  it('still offers the wallet nudge when the card history cannot be read', () => {
    // `isCardSpendResolved` is true on failure as well as on success, so an
    // unreachable history does not withhold the banner indefinitely.
    expect(step({ isCardSpendResolved: true, hasSpentOnCard: false })).toBe('add-to-wallet');
  });

  it('shows the cashback banner once the card has been spent on', () => {
    expect(step({ hasSpentOnCard: true })).toBe('cashback');
  });

  it('shows cashback as soon as spend is known, without waiting further', () => {
    expect(step({ hasSpentOnCard: true, isCardSpendResolved: false })).toBe('cashback');
  });

  it('cashback outranks the wallet nudge — spend is the last rung', () => {
    expect(step({ hasSpentOnCard: true, eligibility: { alreadyInAppleWallet: false } })).toBe(
      'cashback',
    );
    // And it is reached on desktop web too, where no wallet prompt exists.
    expect(step({ hasSpentOnCard: true, wallet: null })).toBe('cashback');
  });
});
