import { Platform } from 'react-native';

import { useCardStatus } from '@/hooks/useCardStatus';
import { useWalletEligibility } from '@/hooks/useWalletEligibility';
import { shouldPromptToFinishKyc } from '@/lib/utils/kyc/verificationProgress';
import { HomePromptKey, isHomePromptSnoozed, useHomePromptStore } from '@/store/useHomePromptStore';
import { useKycStore } from '@/store/useKycStore';
import { useUserStore } from '@/store/useUserStore';

interface UseHomePromptParams {
  /** Whether the user already holds an active card. */
  hasCard: boolean;
  /** Whether the user has funded their account. */
  depositCompleted: boolean;
}

/**
 * Picks which prompt card (if any) the redesigned home screen should show, in
 * onboarding order: finish verification → fund the wallet → add the card to
 * Apple Pay.
 *
 * "Finish verification" is a nudge for an abandoned KYC, so it only shows to
 * users who started verification and still have a step left. Users who never
 * started aren't nagged here — the wallet card's own "Get your card" panel is
 * their entry point — and users waiting on a decision (under review, Rain
 * pending) aren't either, since there is nothing for them to finish.
 *
 * Each variant can be dismissed independently and comes back after its entry in
 * {@link HOME_PROMPT_SNOOZE_MS}; a snoozed variant hides the card rather than
 * falling through to a later step, since the earlier step is still the one the
 * user needs to do.
 */
export function useHomePrompt({
  hasCard,
  depositCompleted,
}: UseHomePromptParams): HomePromptKey | null {
  const dismissedAt = useHomePromptStore(state => state.dismissedAt);
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const kycStartedAt = useKycStore(state => (userId ? state.kycStartedAt[userId] : undefined));
  const { data: cardStatus } = useCardStatus();

  // Only iOS gets the Apple Pay prompt, and only once the card exists and is
  // funded — otherwise there's nothing to provision or nothing to spend.
  const walletPromptPossible = hasCard && depositCompleted && Platform.OS === 'ios';
  const { data: eligibility } = useWalletEligibility(walletPromptPossible);

  let key: HomePromptKey | null = null;
  if (!hasCard) {
    // No fall-through to the funding prompt: without a card the user's next
    // step is the card, not a top-up, so no prompt beats the wrong prompt.
    key = shouldPromptToFinishKyc(cardStatus, kycStartedAt ?? null) ? 'verification' : null;
  } else if (!depositCompleted) {
    key = 'fund';
  } else if (walletPromptPossible && eligibility && !eligibility.alreadyInAppleWallet) {
    key = 'apple-pay';
  }

  if (!key || isHomePromptSnoozed(dismissedAt, key)) return null;
  return key;
}
