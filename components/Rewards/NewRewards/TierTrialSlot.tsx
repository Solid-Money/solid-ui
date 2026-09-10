import { useEffect, useState } from 'react';

import { HERO_EXIT, HeroExit } from '@/components/Card/NewCardDetails/heroMotion';
import { useRewardsUserData } from '@/hooks/useRewards';
import { useTierTrialStore } from '@/store/useTierTrialStore';

import TierTrialBanner from './TierTrialBanner';
import TierTrialOfferPopup from './TierTrialOfferPopup';

/**
 * The tier-trial card on the wallet screen, and the popup behind it.
 *
 * Renders nothing at all when the user has no trial, which is the common case —
 * an empty wrapper would still take a slot in the parent's flex gap.
 *
 * A trial waiting to be started shows the offer, and the popup opens itself
 * once so a gift is not left sitting unnoticed behind a banner. After that the
 * banner is the way in: "Maybe later" leaves the offer claimable, and an offer
 * that reappeared on top of the screen at every launch would not be an offer.
 *
 * A trial already running shows "You're on {tier}" instead, with no popup — it
 * is news rather than a decision, and the countdown on the rewards screen is
 * where the detail lives.
 *
 * The hero-exit wrapper and the side padding are applied here rather than by
 * the caller for the same reason `HomePromoBanners` does it: the empty case has
 * to leave nothing behind at all, and a wrapper around nothing would still take
 * a slot in the wallet column's flex gap.
 */
const TierTrialSlot = () => {
  const { data } = useRewardsUserData();
  const pending = data?.pendingTierTrial;
  const active = data?.activeTierTrial;
  const trial = pending ?? active ?? null;

  const offerSeen = useTierTrialStore(state => (pending ? !!state.offerSeen[pending.id] : true));
  const markOfferSeen = useTierTrialStore(state => state.markOfferSeen);
  const [isOfferOpen, setIsOfferOpen] = useState(false);

  useEffect(() => {
    if (!pending || offerSeen) return;
    // Marked before it opens, not on dismissal: a user who closes the app
    // rather than answering has still been shown it, and re-opening it on every
    // launch until they tap something would be the wrong kind of persistent.
    markOfferSeen(pending.id);
    setIsOfferOpen(true);
  }, [pending, offerSeen, markOfferSeen]);

  if (!trial) return null;

  return (
    <>
      <HeroExit spec={HERO_EXIT.belowCard}>
        <TierTrialBanner
          trial={trial}
          className="px-4"
          onActivate={pending ? () => setIsOfferOpen(true) : undefined}
        />
      </HeroExit>
      {!!pending && (
        <TierTrialOfferPopup
          trial={pending}
          isOpen={isOfferOpen}
          onDismiss={() => setIsOfferOpen(false)}
        />
      )}
    </>
  );
};

export default TierTrialSlot;
