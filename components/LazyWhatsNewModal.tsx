import React, { Suspense } from 'react';

import { WhatsNew } from '@/lib/types';

// Lazy load WhatsNewModal - this component imports react-native-reanimated-carousel
// which is a heavy library. Since WhatsNewModal is only shown conditionally for
// authenticated users, we defer its bundle to improve FCP for all routes.
const WhatsNewModal = React.lazy(() => import('./WhatsNewModal'));

interface LazyWhatsNewModalProps {
  whatsNew: WhatsNew;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Lazy-loaded wrapper for WhatsNewModal component
 *
 * PERFORMANCE: WhatsNewModal imports react-native-reanimated-carousel which adds
 * significant bundle weight. Since this modal is only shown for authenticated users
 * and only when there's new content, lazy-loading it removes this bundle from the
 * critical rendering path for ALL routes, improving FCP across the app.
 *
 * No fallback needed since:
 * 1. The modal is hidden by default (isOpen starts false)
 * 2. When triggered, the lazy load is near-instant due to code splitting
 */
const LazyWhatsNewModal = ({ whatsNew, isOpen, onClose }: LazyWhatsNewModalProps) => {
  // Don't render anything if not open - avoid loading the bundle until needed
  if (!isOpen) return null;

  return (
    <Suspense fallback={null}>
      <WhatsNewModal whatsNew={whatsNew} isOpen={isOpen} onClose={onClose} />
    </Suspense>
  );
};

export default LazyWhatsNewModal;
