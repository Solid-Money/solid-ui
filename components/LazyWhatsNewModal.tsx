import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';

import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { WhatsNew } from '@/lib/types';
import { isSingleWhatsNew, singleLeadImageUrl } from '@/lib/whatsNew';

// Lazy load WhatsNewModal - this component imports react-native-reanimated-carousel
// which is a heavy library. Since WhatsNewModal is only shown conditionally for
// authenticated users, we defer its bundle to improve FCP for all routes.
const WhatsNewModal = lazyWithRetry(() => import('./WhatsNewModal'));
// The single image or video has its own bundle, so showing one never loads the carousel.
const WhatsNewSingle = lazyWithRetry(() => import('./WhatsNew/WhatsNewSingle'));

interface LazyWhatsNewModalProps {
  whatsNew: WhatsNew;
  isOpen: boolean;
  onClose: () => void;
  /**
   * A single's image or video poster failed to load, so it never showed. It
   * should close without being marked as seen.
   */
  onFailed: () => void;
}

/**
 * Lazy-loaded wrapper for both What's New formats.
 *
 * PERFORMANCE: WhatsNewModal imports react-native-reanimated-carousel which adds
 * significant bundle weight. Since this modal is only shown for authenticated users
 * and only when there's new content, lazy-loading it removes this bundle from the
 * critical rendering path for ALL routes, improving FCP across the app.
 *
 * No visible fallback is needed: the modal stays hidden while its images are
 * prefetched and while the lazy bundle is loading.
 *
 * A single shows only once its image, or its video's poster, is in the cache.
 * If that fails it never shows and isn't marked as seen; a carousel shows once
 * its requests have settled either way, as it always has.
 */
const LazyWhatsNewModal = ({ whatsNew, isOpen, onClose, onFailed }: LazyWhatsNewModalProps) => {
  const single = isSingleWhatsNew(whatsNew) ? whatsNew : null;
  const imageUrls = useMemo(
    () =>
      single
        ? [singleLeadImageUrl(single)]
        : whatsNew.steps.map(step => step.imageUrl.trim()).filter(Boolean),
    [single, whatsNew.steps],
  );
  const imageKey = `${whatsNew._id}|${imageUrls.join('|')}`;
  const [preparedImageKey, setPreparedImageKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || preparedImageKey === imageKey) return;

    let isCancelled = false;

    const prepareImages = async () => {
      // Wait for every request to settle. `Image.prefetch(urls)` resolves as soon
      // as one URL fails, which could reveal the modal while another image is
      // still downloading.
      const loaded = await Promise.all(
        imageUrls.map(imageUrl => Image.prefetch(imageUrl, 'memory-disk').catch(() => false)),
      );

      if (isCancelled) return;

      if (single && !loaded.every(Boolean)) {
        onFailed();
        return;
      }

      setPreparedImageKey(imageKey);
    };

    void prepareImages();

    return () => {
      isCancelled = true;
    };
  }, [imageKey, imageUrls, isOpen, onFailed, preparedImageKey, single]);

  // Keep the dialog unmounted until it is open and its image requests have settled.
  if (!isOpen || preparedImageKey !== imageKey) return null;

  return (
    <Suspense fallback={null}>
      {single ? (
        <WhatsNewSingle whatsNew={single} onClose={onClose} />
      ) : (
        <WhatsNewModal whatsNew={whatsNew} isOpen={isOpen} onClose={onClose} />
      )}
    </Suspense>
  );
};

export default LazyWhatsNewModal;
