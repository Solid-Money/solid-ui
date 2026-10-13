import { View } from 'react-native';
import { Image } from 'expo-image';

import { getAsset } from '@/lib/assets';

import {
  REFERENCE_BADGE_SIZE,
  scaleBrandGlyph,
  type SubscriptionBrand,
} from './subscriptionBrands';

interface SubscriptionBrandBadgeProps {
  brand: SubscriptionBrand;
  /** Badge diameter. The brand's glyph scales with it. */
  size: number;
  /** Left margin, negative to step badges over each other in a stack. */
  overlap?: number;
  /**
   * Card-colored ring around the badge, which keeps overlapping badges
   * separable. Off for standalone badges, which the design draws flush.
   */
  ring?: boolean;
}

/**
 * One subscription brand logo in a circular badge, at any size.
 *
 * Brands whose asset already bakes in its own circle and ring render the asset
 * straight into the slot; the rest are bare glyphs drawn over the brand color.
 */
const SubscriptionBrandBadge = ({ brand, size, overlap, ring }: SubscriptionBrandBadgeProps) => {
  const offset = overlap === undefined ? undefined : { marginLeft: overlap };

  // Already a complete badge — wrapping it would double up on its baked-in ring.
  if (!brand.background) {
    return (
      <Image
        source={getAsset(brand.asset)}
        style={[{ width: size, height: size }, offset]}
        contentFit="contain"
      />
    );
  }

  // Exported badges have a 22px face and a 2px ring on a 26px canvas. Match
  // that geometry for badges assembled from a background and a bare glyph.
  const faceSize = ring ? (size * REFERENCE_BADGE_SIZE) / (REFERENCE_BADGE_SIZE + 4) : size;
  const glyph = scaleBrandGlyph(brand, faceSize);

  return (
    <View
      className={`items-center justify-center overflow-hidden rounded-full ${
        ring ? 'bg-card' : ''
      }`}
      style={[
        { width: size, height: size, backgroundColor: ring ? undefined : brand.background },
        offset,
      ]}
    >
      <View
        className="items-center justify-center overflow-hidden rounded-full"
        style={{ width: faceSize, height: faceSize, backgroundColor: brand.background }}
      >
        <Image
          source={getAsset(brand.asset)}
          style={{ width: glyph.width, height: glyph.height }}
          contentFit="contain"
        />
        {brand.overlay ? (
          <Image
            source={getAsset(brand.overlay.asset)}
            style={[{ position: 'absolute' }, scaleBrandGlyph(brand.overlay, faceSize)]}
            contentFit="contain"
          />
        ) : null}
      </View>
    </View>
  );
};

export default SubscriptionBrandBadge;
