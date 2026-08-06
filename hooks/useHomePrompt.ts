import { Platform } from 'react-native';

import { useWalletEligibility } from '@/hooks/useWalletEligibility';
import { HomePromptKey, isHomePromptSnoozed, useHomePromptStore } from '@/store/useHomePromptStore';

interface UseHomePromptParams {
  /** Whether the user already holds an active card. */
  hasCard: boolean;
  /** Whether the user has funded their account. */
  depositCompleted: boolean;
}

/**
 * Picks which prompt card (if any) the redesigned home screen should show, in
 * onboarding order: get verified → fund the wallet → add the card to Apple Pay.
 *
 * Each variant can be dismissed independently and comes back after
 * {@link HOME_PROMPT_SNOOZE_MS}; a snoozed variant hides the card rather than
 * falling through to a later step, since the earlier step is still the one the
 * user needs to do.
 */
export function useHomePrompt({
  hasCard,
  depositCompleted,
}: UseHomePromptParams): HomePromptKey | null {
  const dismissedAt = useHomePromptStore(state => state.dismissedAt);

  // Only iOS gets the Apple Pay prompt, and only once the card exists and is
  // funded — otherwise there's nothing to provision or nothing to spend.
  const walletPromptPossible = hasCard && depositCompleted && Platform.OS === 'ios';
  const { data: eligibility } = useWalletEligibility(walletPromptPossible);

  let key: HomePromptKey | null = null;
  if (!hasCard) {
    key = 'verification';
  } else if (!depositCompleted) {
    key = 'fund';
  } else if (walletPromptPossible && eligibility && !eligibility.alreadyInAppleWallet) {
    key = 'apple-pay';
  }

  if (!key || isHomePromptSnoozed(dismissedAt, key)) return null;
  return key;
}
