import { DEVICE_DIGITAL_WALLET } from '@/constants/digital-wallet';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { useWalletEligibility } from '@/hooks/useWalletEligibility';
import { resolveHomePromptStep } from '@/lib/utils/homePromptStep';
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
 * Picks which CTA banner (if any) the wallet screen shows under the card.
 *
 * The ladder itself lives in `resolveHomePromptStep`, which is pure and tested;
 * this gathers its inputs and applies the dismissal snooze on top. A snoozed
 * banner hides the slot rather than advertising a later step the user cannot
 * reach yet — the one exception being the terminal `cashback` banner, which has
 * no ✕ and therefore never snoozes (see `HomePromptKey`).
 */
export function useHomePrompt({
  hasCard,
  depositCompleted,
}: UseHomePromptParams): HomePromptKey | null {
  const dismissedAt = useHomePromptStore(state => state.dismissedAt);
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const kycStartedAt = useKycStore(state => (userId ? state.kycStartedAt[userId] : undefined));
  const { data: cardStatus } = useCardStatus();

  // Only ask about provisioning once the card exists and is funded — otherwise
  // there's nothing to provision or nothing to spend.
  const walletPromptPossible = hasCard && depositCompleted && DEVICE_DIGITAL_WALLET !== null;
  const { data: eligibility } = useWalletEligibility(walletPromptPossible);

  // Same query key the wallet screen's activity feed already uses, so this is a
  // cache read rather than a second request.
  const { data: cardTransactions } = useCardTransactions({ enabled: hasCard });

  const key = resolveHomePromptStep({
    hasCard,
    depositCompleted,
    cardStatus,
    kycStartedAt,
    hasSpentOnCard: (cardTransactions?.pages ?? []).some(page => page.data.length > 0),
    wallet: walletPromptPossible ? DEVICE_DIGITAL_WALLET : null,
    eligibility,
  });

  if (!key || isHomePromptSnoozed(dismissedAt, key)) return null;
  return key;
}
