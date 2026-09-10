import { useEffect, useState } from 'react';
import { router } from 'expo-router';

import TierPopup from '@/components/Rewards/NewRewards/TierPopup';
import {
  benefitsForTier,
  tierPopupStats,
  upgradeCelebrationCopy,
} from '@/components/Rewards/NewRewards/tierTrialCopy';
import { path } from '@/constants/path';
import { useRewardsUserData, useTierBenefits } from '@/hooks/useRewards';
import { REWARDS_RECONCILIATION_INTERVAL_MS } from '@/lib/rewardsUpgrade';
import { useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserStore } from '@/store/useUserStore';

/**
 * The tier-upgrade celebration, shown once per observed promotion.
 *
 * Mounted on the protected layout rather than on the rewards screen, because a
 * tier can arrive from anywhere: a points milestone reached while spending, a
 * FUSE deposit confirming in Savings, or a trial the user just activated from a
 * banner on the wallet screen. Whichever it was, `useRewardsUpgradeStore`
 * notices `currentTier` rising between two reads of the rewards payload and
 * hands it here — so all three routes get the same celebration and none of them
 * has to open it itself.
 *
 * The words change with the route (see `upgradeCelebrationCopy`); the card does
 * not (Figma 25480:2355).
 */
export default function RewardsUpgradeFeedback() {
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const state = useRewardsUpgradeStore();
  const active = userId === state.userId;
  const { data: tierBenefits } = useTierBenefits();
  useRewardsUserData({
    refetchInterval: active && state.pendingUntil ? REWARDS_RECONCILIATION_INTERVAL_MS : false,
  });

  useEffect(() => {
    if (!active || !state.pendingUntil) return;
    const timer = setTimeout(state.finishWaiting, Math.max(0, state.pendingUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [active, state.pendingUntil, state.finishWaiting]);

  const success = active ? state.success : undefined;

  // Held after dismissal so the card can animate out: `dismiss` clears
  // `success`, and unmounting the popup on that would make it vanish rather
  // than fade. Only ever moves forward onto a real upgrade.
  const [shown, setShown] = useState(success);
  useEffect(() => {
    if (success) setShown(success);
  }, [success]);

  if (!shown) return null;

  const copy = upgradeCelebrationCopy(shown);

  return (
    <TierPopup
      isOpen={!!success}
      tier={shown.currentTier}
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      // The tier's own benefits, not this user's rates: an override pinned to
      // one cardholder is not what "Welcome to Prime" is announcing.
      stats={tierPopupStats(benefitsForTier(tierBenefits, shown.currentTier))}
      note={copy.note}
      primaryLabel="Explore benefits"
      onPrimary={() => {
        state.dismiss();
        router.push(path.REWARDS_BENEFITS);
      }}
      secondaryLabel="Done"
      onSecondary={state.dismiss}
      footnote="Benefits and monthly limits apply."
    />
  );
}
