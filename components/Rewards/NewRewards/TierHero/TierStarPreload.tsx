import { type PropsWithChildren, useEffect } from 'react';
import { Image } from 'expo-image';

import { resolveAssetUri } from '@/lib/utils/assetUri';

import { TIER_STAR_ANIMATIONS } from './TierStar';

// Android and web use WebP instead of the iOS video. Warm the image cache
// before opening benefits too, using the same policy as the displayed stars.
export default function TierStarPreloadProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const urls = Object.values(TIER_STAR_ANIMATIONS)
      .map(source => resolveAssetUri(source))
      .filter((uri): uri is string => Boolean(uri));
    if (urls.length) void Image.prefetch(urls, 'memory-disk').catch(() => undefined);
  }, []);
  return children;
}
