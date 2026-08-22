import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import { path } from '@/constants/path';

/**
 * `/card/details` is retired as a page. The card details surface is now the
 * wallet screen's card pane — a layer on an already-mounted tree, which is what
 * lets the card fly into place without a screen mounting underneath it (see
 * `CardDetailsPane`). This route survives only as a redirect, because old deep
 * links, push-notification payloads and bookmarks still point at it.
 *
 * The whole page used to live here, with mobile redirecting and desktop
 * rendering a second, separate implementation of the same screen. Desktop now
 * redirects too: the pane lays itself out as a column beside the sidebar, so one
 * surface serves both and there is no longer a version of the card screen that
 * only some users see.
 */
export default function CardDetails() {
  const router = useRouter();

  useEffect(() => {
    // `replace`, not `push`: back must not land on this shim and bounce the user
    // forward again. The wallet reads `?screen=card-info` and opens the pane.
    router.replace(path.CARD_INFO);
  }, [router]);

  return (
    <PageLayout isLoading showNavbar={false}>
      <View />
    </PageLayout>
  );
}
