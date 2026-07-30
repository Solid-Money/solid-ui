import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/text';

/** Total height of the band. Its foot is tucked behind the perks card below. */
export const TIER_STATS_BAND_HEIGHT = 137;
/** How much of that foot the perks card covers. */
export const TIER_STATS_BAND_TUCK = 41;
/** The part that stays on screen — the stats sit here so nothing is tucked away. */
const VISIBLE_HEIGHT = TIER_STATS_BAND_HEIGHT - TIER_STATS_BAND_TUCK;

const BAND_GRADIENT = ['rgba(148, 242, 127, 0.15)', 'rgba(148, 242, 127, 0.05)'] as const;
const DIVIDER_COLOR = 'rgba(255, 255, 255, 0.1)';

// One tile of the wave texture: two half-period-offset rows, so tiling weaves them.
const WAVE_TILE = { width: 40, height: 26 };
const WAVE_COLOR = 'rgba(255, 255, 255, 0.08)';

/** Measured off the design's band: 26px value over a 16px label. */
const VALUE_STYLE = { fontFamily: 'MonaSans_600SemiBold', fontSize: 26, lineHeight: 30 } as const;
const LABEL_STYLE = { fontFamily: 'MonaSans_400Regular', fontSize: 16, lineHeight: 19 } as const;

export interface TierStat {
  label: string;
  /** Empty for a label-only column, e.g. Core's "24/7 Fast support". */
  value: string;
}

/**
 * Tiled wave texture, drawn rather than shipped as a bitmap so it never stretches
 * with the band. Swap in an exported asset here if the design's own texture is
 * needed — `<Image resizeMode="repeat">` keeps the same tiling behaviour.
 */
const WaveTexture = () => (
  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
    <Defs>
      <Pattern
        id="tierStatsWaves"
        x="0"
        y="0"
        width={WAVE_TILE.width}
        height={WAVE_TILE.height}
        patternUnits="userSpaceOnUse"
      >
        <Path d="M0 6.5 Q 10 0 20 6.5 T 40 6.5" stroke={WAVE_COLOR} strokeWidth={1} fill="none" />
        <Path
          d="M0 19.5 Q 10 26 20 19.5 T 40 19.5"
          stroke={WAVE_COLOR}
          strokeWidth={1}
          fill="none"
        />
      </Pattern>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#tierStatsWaves)" />
  </Svg>
);

/**
 * The green headline stats above each tier's perks card — two columns for Core, three
 * for Prime and Ultra, split by hairline dividers.
 *
 * This used to be a flat PNG per tier drawn with `contentFit="fill"`, which stretched
 * its baked-in text horizontally as soon as the band was wider than the 385px it was
 * exported at — badly so on desktop. Everything here is laid out instead, so it holds
 * at any width, and the copy comes from the tier's own `stats`.
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
