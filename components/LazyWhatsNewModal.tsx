import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';

import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { WhatsNew } from '@/lib/types';
import { isSingleWhatsNew, singleLeadImageUrl } from '@/lib/whatsNew';

// Lazy load the carousel. It is only shown to signed-in users with something
// new to see, so its bundle (and expo-video's) stays off every route's
// critical path.
const WhatsNewModal = lazyWithRetry(() => import('./WhatsNewModal'));
// The single image or video has its own bundle, so showing one never loads the carousel.
const WhatsNewSingle = lazyWithRetry(() => import('./WhatsNew/WhatsNewSingle'));

interface LazyWhatsNewModalProps {
  whatsNew: WhatsNew;
  isOpen: boolean;
  onClose: () => void;
  /** The page to open on, passed through to `WhatsNewModal`. */
  initialStep?: number;
  /**
   * A single's image or video poster failed to load, so it never showed. It
   * should close without being marked as seen.
   */
  onFailed: () => void;
}

/**
 * Lazy-loaded wrapper for both What's New formats.
 *
 * PERFORMANCE: both formats are only shown to signed-in users with new content,
 * so lazy-loading them keeps their bundles (and expo-video) off the critical
 * rendering path for ALL routes, improving FCP across the app.
 *
 * No visible fallback is needed: the modal stays hidden while its images are
 * prefetched and while the lazy bundle is loading.
 *
 * A single shows only once its image, or its video's poster, is in the cache.
 * If that fails it never shows and isn't marked as seen; a carousel shows once
 * its requests have settled either way, as it always has.
 */
const LazyWhatsNewModal = ({
  whatsNew,
  isOpen,
  onClose,
  onFailed,
  initialStep = 0,
}: LazyWhatsNewModalProps) => {
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
        // A single has no pages, so a link's page doesn't apply to it.
        <WhatsNewSingle key={whatsNew._id} whatsNew={single} onClose={onClose} />
      ) : (
        <WhatsNewModal
          // Remounts for a different page or announcement, so the carousel starts
          // there instead of keeping the index of the previous opening.
          key={`${whatsNew._id}-${initialStep}`}
          whatsNew={whatsNew}
          isOpen={isOpen}
          onClose={onClose}
          initialStep={initialStep}
        />
      )}
    </Suspense>
  );
};

export default LazyWhatsNewModal;
