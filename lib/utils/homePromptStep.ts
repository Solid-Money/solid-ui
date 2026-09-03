import { DigitalWalletType } from '@/constants/digital-wallet';
import { CardStatusResponse } from '@/lib/types';
import { KycProgress, resolveKycProgress } from '@/lib/utils/kyc/verificationProgress';

import type { HomePromptKey } from '@/store/useHomePromptStore';

export interface HomePromptStepInput {
  /** Whether the user holds a usable (active/frozen, non-Bridge) card. */
  hasCard: boolean;
  /** Whether the user has funded their account. */
  depositCompleted: boolean;
  /** `/cards/status`, or null/undefined before it has answered. */
  cardStatus: CardStatusResponse | null | undefined;
  /** Local "the provider SDK was opened" marker — see `hasStartedKyc`. */
  kycStartedAt?: number | null;
  /** Whether the card already has spend against it. */
  hasSpentOnCard: boolean;
  /**
   * The wallet this device can add the card to, or null off-device (desktop
   * web), where there is no wallet to provision into.
   */
  wallet: DigitalWalletType | null;
  /** Push-provisioning state, once asked for. */
  eligibility?: {
    alreadyInAppleWallet?: boolean;
    alreadyInGoogleWallet?: boolean;
  } | null;
}

/**
 * Which rung of the card funnel the user is on, and therefore which CTA banner
 * the wallet screen shows under the card (Figma 25141:6965):
 *
 * 1. `get-card` — never entered verification.
 * 2. `verification` — entered it and walked away.
 * 3. `kyc-review` — submitted; waiting on a decision.
 * 4. `kyc-rejected` — declined.
 * 5. `activate-card` — verified, no card issued yet.
 * 6. `fund` — card issued, account unfunded.
 * 7. `add-to-wallet` — funded card that isn't in Apple/Google Wallet.
 * 8. `cashback` — the card has been used; the terminal banner.
 *
 * Pure, so the ladder can be tested without mounting the screen. `useHomePrompt`
 * gathers the inputs, applies the snooze and hands the answer to
 * `HomePromptCard`.
 *
 * There is deliberately no fall-through between rungs: the step the user is
 * actually on is the only one worth showing, and no banner beats the wrong
 * banner. Both issuers feed this — `resolveKycProgress` folds Rain's application
 * status and the backend `kycStatus` (which is what the Wirex/Sumsub flow
 * reports) into one ladder, so neither provider needs a branch here.
 */
export function resolveHomePromptStep({
  hasCard,
  depositCompleted,
  cardStatus,
  kycStartedAt,
  hasSpentOnCard,
  wallet,
  eligibility,
}: HomePromptStepInput): HomePromptKey | null {
  if (!hasCard) return kycBanner(resolveKycProgress(cardStatus, kycStartedAt ?? null));

  if (!depositCompleted) return 'fund';

  // The card has been used, so every earlier step is behind the user. This
  // outranks the wallet nudge: the design treats "has transactions" as the last
  // rung of the ladder, and this banner is the one that then stays for good.
  if (hasSpentOnCard) return 'cashback';

  // Only ask a device that has a wallet, and only once eligibility has answered
  // — an unknown answer must not be read as "not in the wallet yet".
  if (wallet && eligibility && !isCardInWallet(wallet, eligibility)) return 'add-to-wallet';

  return null;
}

/** The banner for a user with no card, keyed on how far verification got. */
function kycBanner(progress: KycProgress): HomePromptKey {
  switch (progress) {
    case 'not-started':
      return 'get-card';
    case 'unfinished':
      return 'verification';
    case 'in-review':
      return 'kyc-review';
    case 'rejected':
      return 'kyc-rejected';
    case 'approved':
      // Verified but no usable card yet. That covers a card the issuer has
      // ordered and not opened (`pending`) as well as one never ordered; both
      // resume at /card/activate, which is where the CTA sends them.
      return 'activate-card';
  }
}

/** Whether the card is already in the wallet this device would add it to. */
function isCardInWallet(
  wallet: DigitalWalletType,
  eligibility: NonNullable<HomePromptStepInput['eligibility']>,
): boolean {
  return wallet === DigitalWalletType.Google
    ? Boolean(eligibility.alreadyInGoogleWallet)
    : Boolean(eligibility.alreadyInAppleWallet);
}
