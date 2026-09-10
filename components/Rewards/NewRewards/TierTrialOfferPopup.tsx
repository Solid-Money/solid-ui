import { useActivateTierTrial, useTierBenefits } from '@/hooks/useRewards';
import { TierTrial } from '@/lib/types';

import TierPopup from './TierPopup';
import { benefitsForTier, tierPopupStats, trialOfferCopy } from './tierTrialCopy';

interface TierTrialOfferPopupProps {
  /** The trial waiting to be started. */
  trial: TierTrial;
  isOpen: boolean;
  /** "Maybe later", the backdrop, and a failed activation all land here. */
  onDismiss: () => void;
}

/**
 * The opt-in popup for a trial the user has been given: an admin gift today,
 * the welcome offer once that ships.
 *
 * Activation is required and is the only thing that starts the clock — which is
 * why "Maybe later" is a real option and not a way of losing the gift. The
 * offer stays on the account, so dismissing here only closes the popup and
 * leaves the banner to offer it again.
 *
 * The celebration that follows is not opened from here. Activating writes the
 * new tier into the rewards cache, and the upgrade watcher mounted on the
 * protected layout shows the celebration off the back of that — the same path a
 * points or FUSE upgrade takes, so all three look identical to the user.
 */
const TierTrialOfferPopup = ({ trial, isOpen, onDismiss }: TierTrialOfferPopupProps) => {
  const { data: tierBenefits } = useTierBenefits();
  const { mutate: activate, isPending } = useActivateTierTrial();
  const copy = trialOfferCopy(trial);

  return (
    <TierPopup
      isOpen={isOpen}
      tier={trial.tier}
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      stats={tierPopupStats(benefitsForTier(tierBenefits, trial.tier))}
      note={copy.note}
      primaryLabel={isPending ? 'Activating…' : copy.primaryLabel}
      isPrimaryPending={isPending}
      onPrimary={() =>
        activate(undefined, {
          onSuccess: () => {
            // Close before the celebration lands, so the two popups never
            // overlap: the upgrade watcher opens the next one on the tier
            // change this activation just wrote.
            onDismiss();
          },
          // Left open on failure with the button live again — the offer is
          // still there to accept, and the API layer has said what went wrong.
          onError: () => undefined,
        })
      }
      secondaryLabel={copy.secondaryLabel}
      onSecondary={() => {
        if (isPending) return;
        onDismiss();
      }}
      footnote={copy.footnote}
    />
  );
};

export default TierTrialOfferPopup;
