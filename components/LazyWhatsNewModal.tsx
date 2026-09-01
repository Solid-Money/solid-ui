import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';

import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { WhatsNew } from '@/lib/types';

// Lazy load WhatsNewModal - this component imports react-native-reanimated-carousel
// which is a heavy library. Since WhatsNewModal is only shown conditionally for
// authenticated users, we defer its bundle to improve FCP for all routes.
const WhatsNewModal = lazyWithRetry(() => import('./WhatsNewModal'));

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
 * No visible fallback is needed: the modal stays hidden while its images are
 * prefetched and while the lazy bundle is loading.
 */
const LazyWhatsNewModal = ({ whatsNew, isOpen, onClose }: LazyWhatsNewModalProps) => {
  const imageUrls = useMemo(
    () => whatsNew.steps.map(step => step.imageUrl.trim()).filter(Boolean),
    [whatsNew.steps],
  );
  const imageKey = imageUrls.join('|');
  const [preparedImageKey, setPreparedImageKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || preparedImageKey === imageKey) return;

    let isCancelled = false;

    const prepareImages = async () => {
      // Wait for every request to settle. `Image.prefetch(urls)` resolves as soon
      // as one URL fails, which could reveal the modal while another image is
      // still downloading.
      await Promise.all(
        imageUrls.map(imageUrl => Image.prefetch(imageUrl, 'memory-disk').catch(() => false)),
      );

      if (!isCancelled) {
        setPreparedImageKey(imageKey);
      }
    };

    void prepareImages();

    return () => {
      isCancelled = true;
    };
  }, [imageKey, imageUrls, isOpen, preparedImageKey]);

  // Keep the dialog unmounted until it is open and its image requests have settled.
  if (!isOpen || preparedImageKey !== imageKey) return null;

  return (
    <Suspense fallback={null}>
      <WhatsNewModal whatsNew={whatsNew} isOpen={isOpen} onClose={onClose} />
    </Suspense>
  );
};

export default LazyWhatsNewModal;
