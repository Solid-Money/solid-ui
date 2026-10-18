import { DEVICE_DIGITAL_WALLET } from '@/constants/digital-wallet';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { useDeclinedPaymentPrompt } from '@/hooks/useDeclinedPaymentPrompt';
import { useUnusableEurc } from '@/hooks/useUnusableEurc';
import { useWalletEligibility } from '@/hooks/useWalletEligibility';
import { CardProvider } from '@/lib/types';
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
  const { data: cardTransactions, isLoading: isCardSpendLoading } = useCardTransactions({
    enabled: hasCard,
  });

  // The two Wirex-only steps. Both reads are already on Home for a Wirex cardholder (the card
  // history above, the spend tile's balance), and both are off for everyone else.
  const { provider } = useCardProvider();
  const isWirexCardholder = hasCard && provider === CardProvider.WIREX;
  const declinedPayment = useDeclinedPaymentPrompt(isWirexCardholder);
  const { eurc } = useUnusableEurc();

  const key = resolveHomePromptStep({
    hasCard,
    depositCompleted,
    cardStatus,
    kycStartedAt,
    hasSpentOnCard: (cardTransactions?.pages ?? []).some(page => page.data.length > 0),
    // `isLoading` rather than "is there data": it is false once the request has
    // failed as well as once it has answered, so an unreachable card history
    // does not withhold the wallet nudge for good.
    isCardSpendResolved: !isCardSpendLoading,
    wallet: walletPromptPossible ? DEVICE_DIGITAL_WALLET : null,
    eligibility,
    hasUncoveredDecline: isWirexCardholder && !!declinedPayment,
    holdsUnusableEurc: isWirexCardholder && eurc > 0,
  });

  if (!key || isHomePromptSnoozed(dismissedAt, key)) return null;
  return key;
}
