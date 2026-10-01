import { type PropsWithChildren, useEffect } from 'react';
// Asset URL resolution only; rendering and caching use expo-image.
// eslint-disable-next-line no-restricted-imports
import { Image as NativeImage } from 'react-native';
import { Image } from 'expo-image';

import { TIER_STAR_ANIMATIONS } from './TierStar';

// Android and web use WebP instead of the iOS video. Warm the image cache
// before opening benefits too, using the same policy as the displayed stars.
export default function TierStarPreloadProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const urls = Object.values(TIER_STAR_ANIMATIONS)
      .map(source => NativeImage.resolveAssetSource(source)?.uri)
      .filter((uri): uri is string => Boolean(uri));
    if (urls.length) void Image.prefetch(urls, 'memory-disk').catch(() => undefined);
  }, []);
  return children;
}
