import { View } from 'react-native';
import { Image } from 'expo-image';

import { PORTFOLIO_ICONS } from '@/components/Assets/PortfolioIcon';
import { VaultType } from '@/lib/types';

// Required directly, like PORTFOLIO_ICONS: the asset registry pulls in animated marks.
// TODO(soEURC): the EURC coin mark until design supplies an EUR Yield icon.
const EURC_ICON = require('@/assets/images/eurc.png');

// The ETH and FUSE marks are drawn on a 40.77 × 40 canvas with their own 10% circle;
// the USD glyph is the bare "$", so it gets its circle here.
const CANVAS_RATIO = 40.7692 / 40;
const USD_GLYPH = { width: 12.1184, height: 23.9253 };

interface YieldIconProps {
  vaultType: VaultType;
  size?: number;
  /**
   * `live`: the share token (soUSD / soETH / soFUSE) rather than the product — the same mark
   * with a small green dot, because a share is the product's balance, still earning.
   * `lock`: FUSE committed to a tier, still earning but not withdrawable until its date.
   */
  badge?: 'live' | 'lock';
  /** What the icon sits on, so the badge's ring cuts it out cleanly. */
  ringColor?: string;
}

/** USD Yield / ETH Yield / FUSE Yield / EUR Yield, and with `live` their share tokens. */
export default function YieldIcon({
  vaultType,
  size = 40,
  badge,
  ringColor = '#1C1C1C',
}: YieldIconProps) {
  const scale = size / 40;
  const dot = Math.max(Math.round(size * 0.24), 8);
  const ring = Math.max(Math.round(size * 0.05), 2);

  return (
    <View style={{ width: size * CANVAS_RATIO, height: size }}>
      {vaultType === VaultType.USDC ? (
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: size * CANVAS_RATIO,
            height: size,
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Image
            source={PORTFOLIO_ICONS.usd}
            contentFit="contain"
            style={{ width: USD_GLYPH.width * scale, height: USD_GLYPH.height * scale }}
          />
        </View>
      ) : vaultType === VaultType.EUR ? (
        <Image
          source={EURC_ICON}
          contentFit="contain"
          style={{ width: size * CANVAS_RATIO, height: size, borderRadius: size }}
        />
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
