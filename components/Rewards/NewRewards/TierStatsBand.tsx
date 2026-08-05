import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

/** Total height of the band. Its foot is tucked behind the perks card below. */
export const TIER_STATS_BAND_HEIGHT = 137;
/** How much of that foot the perks card covers. */
export const TIER_STATS_BAND_TUCK = 41;
/** The part that stays on screen — the stats sit here so nothing is tucked away. */
const VISIBLE_HEIGHT = TIER_STATS_BAND_HEIGHT - TIER_STATS_BAND_TUCK;

const BAND_GRADIENT = ['rgba(148, 242, 127, 0.15)', 'rgba(148, 242, 127, 0.05)'] as const;
const DIVIDER_COLOR = 'rgba(255, 255, 255, 0.1)';

// The texture artwork is near-white, so it sits over the gradient at low opacity.
// Matched against the design's own band at 385x137.
const TEXTURE_OPACITY = 0.12;

/** Measured off the design's band: 26px value over a 16px label. */
const VALUE_STYLE = { fontFamily: 'MonaSans_600SemiBold', fontSize: 26, lineHeight: 30 } as const;
const LABEL_STYLE = { fontFamily: 'MonaSans_400Regular', fontSize: 16, lineHeight: 19 } as const;

export interface TierStat {
  label: string;
  /** Empty for a label-only column, e.g. Core's "24/7 Fast support". */
  value: string;
}

/**
 * The design's wave artwork, cropped rather than stretched — `cover` on a repeating
 * pattern is invisible, where `fill` would skew the waves as the band widens.
 */
const WaveTexture = () => (
  <Image
    source={getAsset('images/wave-texture.png')}
    alt=""
    contentFit="cover"
    style={[StyleSheet.absoluteFillObject, { opacity: TEXTURE_OPACITY }]}
  />
);

/**
 * The green headline stats above each tier's perks card — two columns for Core, three
 * for Prime and Ultra, split by hairline dividers.
 *
 * This used to be a flat PNG per tier drawn with `contentFit="fill"`, which stretched
 * its baked-in text horizontally as soon as the band was wider than the 385px it was
 * exported at — badly so on desktop. Everything but the texture is laid out now, so it
 * holds at any width, and the copy comes from the tier's own `stats`.
 */
const TierStatsBand = ({ stats }: { stats: readonly TierStat[] }) => (
  <View
    className="overflow-hidden rounded-t-twice"
    style={{ height: TIER_STATS_BAND_HEIGHT }}
    pointerEvents="none"
  >
    <LinearGradient colors={BAND_GRADIENT} style={StyleSheet.absoluteFill} />
    <WaveTexture />

    <View className="flex-row" style={{ height: VISIBLE_HEIGHT }}>
      {stats.map((stat, index) => (
        <View className="flex-1 flex-row" key={stat.label}>
          {index > 0 && <View style={styles.divider} />}
          <View className="flex-1 items-center justify-center px-2">
            {!!stat.value && (
              <Text className="text-center text-brand" style={VALUE_STYLE}>
                {stat.value}
              </Text>
            )}
            <Text className="text-center text-white" style={LABEL_STYLE}>
              {stat.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  divider: {
    backgroundColor: DIVIDER_COLOR,
    marginVertical: 10,
    width: StyleSheet.hairlineWidth,
  },
});

export default TierStatsBand;
