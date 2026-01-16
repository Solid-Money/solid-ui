import React, { Suspense } from 'react';

// Lazy load DepositOptionModal - this modal is hidden by default and only
// shown when user clicks on certain activity items
const DepositOptionModal = React.lazy(() => import('./DepositOptionModal'));

/**
 * Props for LazyDepositOptionModal
 * Matches the DepositOptionModal props interface
 */
type LazyDepositOptionModalProps = {
  trigger: React.ReactNode | null;
};

/**
 * Lazy-loaded wrapper for DepositOptionModal component
 *
 * PERFORMANCE: DepositOptionModal is imported on the Activity page but is
 * hidden by default (trigger={null}). It only becomes visible when the user
 * clicks on specific activity items. By lazy-loading it, we avoid parsing
 * the modal's logic and styles during the initial page load.
 *
 * No fallback needed since the modal is hidden by default - users won't see
 * any loading state. When they trigger it, the lazy load is near-instant
 * due to code splitting.
 */
const LazyDepositOptionModal = ({ trigger }: LazyDepositOptionModalProps) => {
  return (
    <Suspense fallback={null}>
      <DepositOptionModal trigger={trigger} />
    </Suspense>
  );
};

export default LazyDepositOptionModal;
