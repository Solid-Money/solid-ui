import { View } from 'react-native';
import { Image, type ImageProps } from 'expo-image';

import { PORTFOLIO_ICONS } from '@/components/Assets/PortfolioIcon';
import { getAsset } from '@/lib/assets';
import { VaultType } from '@/lib/types';

// ETH and FUSE include their circles; the other glyphs get the same circle here.
const CANVAS_RATIO = 40.7692 / 40;
const GLYPHS: Partial<
  Record<VaultType, { source: ImageProps['source']; width: number; height: number }>
> = {
  [VaultType.USDC]: { source: PORTFOLIO_ICONS.usd, width: 12.1184, height: 23.9253 },
  // Figma 29123:9532: a 17px euro on a 32 × 31.4 circle.
  [VaultType.EUR]: {
    source: PORTFOLIO_ICONS.euro,
    width: 17 * (40 / 31.396),
    height: 17 * (40 / 31.396),
  },
  [VaultType.BTC]: {
    source: getAsset('images/spend-mode-collateral-btc.svg'),
    width: 28,
    height: 28,
  },
};

interface YieldIconProps {
  vaultType: VaultType;
  size?: number;
  /**
   * `live`: the share token, shown with a small green dot because it is still earning.
   * `lock`: FUSE committed to a tier, still earning but not withdrawable until its date.
   */
  badge?: 'live' | 'lock';
  /** What the icon sits on, so the badge's ring cuts it out cleanly. */
  ringColor?: string;
}

/** Yield product icons, and with `live` their share tokens. */
export default function YieldIcon({
  vaultType,
  size = 40,
  badge,
  ringColor = '#1C1C1C',
}: YieldIconProps) {
  const scale = size / 40;
  const dot = Math.max(Math.round(size * 0.24), 8);
  const ring = Math.max(Math.round(size * 0.05), 2);
  const glyph = GLYPHS[vaultType];

  return (
    <View style={{ width: size * CANVAS_RATIO, height: size }}>
      {glyph ? (
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: size * CANVAS_RATIO,
            height: size,
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Image
            source={glyph.source}
            contentFit="contain"
            style={{ width: glyph.width * scale, height: glyph.height * scale }}
          />
        </View>
      ) : (
        <Image
          source={vaultType === VaultType.ETH ? PORTFOLIO_ICONS.eth : PORTFOLIO_ICONS.fuse}
          contentFit="contain"
          style={{ width: size * CANVAS_RATIO, height: size }}
        />
      )}
      {badge === 'lock' && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute items-center justify-center rounded-full"
          style={{
            right: -size * 0.08,
            bottom: -size * 0.08,
            width: size * 0.45,
            height: size * 0.45,
            backgroundColor: ringColor,
          }}
        >
          <Image
            source={PORTFOLIO_ICONS.lock}
            contentFit="contain"
            style={{ width: size * 0.25, height: size * 0.25 }}
          />
        </View>
      )}
      {badge === 'live' && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute rounded-full"
          style={{
            right: -ring / 2,
            bottom: -ring / 2,
            width: dot + ring * 2,
            height: dot + ring * 2,
            padding: ring,
            backgroundColor: ringColor,
          }}
        >
          <View className="h-full w-full rounded-full bg-[#94F27F]" />
        </View>
      )}
    </View>
  );
}
