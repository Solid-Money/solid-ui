import { Asset } from 'expo-asset';

import type { ImageSourcePropType } from 'react-native';

/**
 * Resolves a bundled asset module (the opaque value `require('@/assets/...')`
 * returns) or a `{ uri }` source to a plain URL string.
 *
 * `Image.resolveAssetSource` from `react-native` cannot be used for this:
 * `react-native-web` does not implement it, so calling it on web throws
 * "resolveAssetSource is not a function" and takes the whole screen down.
 * `expo-asset` resolves module ids on native and web alike.
 *
 * Returns `undefined` rather than throwing when the asset is not registered.
 */
export function resolveAssetUri(
  source: ImageSourcePropType | string | null | undefined,
): string | undefined {
  if (!source) return undefined;
  if (typeof source === 'string') return source;
  if (Array.isArray(source)) return resolveAssetUri(source[0]);
  if (typeof source === 'object') return source.uri || undefined;
  try {
    return Asset.fromModule(source).uri || undefined;
  } catch {
    return undefined;
  }
}
