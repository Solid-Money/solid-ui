import React, { Suspense } from 'react';

import TokenListSkeleton from './WalletTokenTab/TokenListSkeleton';

// Lazy load WalletTabs - this shows the token list and is below the fold
// Deferring it improves FCP while maintaining perceived performance with skeleton
const WalletTabs = React.lazy(() => import('./WalletTabs'));

/**
 * Lazy-loaded wrapper for WalletTabs component
 *
 * PERFORMANCE: WalletTabs renders the user's token list which is typically
 * below the fold on the home screen. By lazy-loading it, we defer parsing
 * of the token rendering logic until after the initial viewport is painted.
 *
 * The skeleton fallback maintains Cumulative Layout Shift (CLS) stability.
 */
const LazyWalletTabs = () => {
  return (
    <Suspense fallback={<TokenListSkeleton />}>
      <WalletTabs />
    </Suspense>
  );
};

export default LazyWalletTabs;
