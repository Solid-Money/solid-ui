import React, { memo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { CHAIN_ICONS } from '@/constants/chains';
import { AssetPath, getAsset } from '@/lib/assets';
import getTokenIcon from '@/lib/getTokenIcon';
import { SwapAsset } from '@/lib/types/lifi-swap';
import { resolveAssetUri } from '@/lib/utils/assetUri';

/** Native currencies have no catalogue logo; these are the app's own marks. */
const NATIVE_LOGOS: Record<number, ReturnType<typeof getAsset>> = {
  [fuse.id]: getAsset('images/fuse.png'),
  [mainnet.id]: getAsset('images/eth.png'),
  [base.id]: getAsset('images/eth.png'),
  [arbitrum.id]: getAsset('images/eth.png'),
  [polygon.id]: getAsset('images/polygon.png'),
  [bsc.id]: getAsset('images/bsc.png'),
};

/** The app assets used in the picker's Figma spec, keyed by grouped asset. */
const PICKER_LOGOS: Record<string, AssetPath> = {
  USDC: 'images/usdc-4x.png',
  USDT: 'images/usdt.png',
  EURC: 'images/eurc.png',
  FUSE: 'images/fuse.png',
  WFUSE: 'images/wfuse.png',
  ETH: 'images/eth.png',
  WETH: 'images/weth.png',
  cbBTC: 'images/cbbtc.png',
  WBTC: 'images/wbtc.png',
  AAVE: 'images/aave.png',
  ENA: 'images/ena.png',
  SOL: 'images/sol.png',
  UNI: 'images/uni.png',
  'USD Yield': 'images/sousd-4x.png',
  'FUSE Yield': 'images/sofuse-4x.png',
};

/** Warm the same sources the picker draws before its first render. */
export function preloadSwapPickerLogos() {
  const urls = [...Object.values(PICKER_LOGOS).map(getAsset), ...Object.values(CHAIN_ICONS)]
    .map(resolveAssetUri)
    .filter((uri): uri is string => Boolean(uri));
  if (urls.length) void Image.prefetch([...new Set(urls)], 'memory-disk').catch(() => undefined);
}

interface SwapAssetLogoProps {
  asset: Pick<SwapAsset, 'chainId' | 'symbol' | 'logoURI' | 'isNative'> | undefined;
  size: number;
  /** The network badge in the corner. Off where the chain is already named. */
  showChain?: boolean;
  pickerKey?: string;
}

const SwapAssetLogo = ({ asset, size, showChain = true, pickerKey }: SwapAssetLogoProps) => {
  if (!asset) {
    return (
      <View
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#2a2a2a' }}
      />
    );
  }

  const pickerLogo = pickerKey && PICKER_LOGOS[pickerKey];
  const localLogo = pickerLogo
    ? getAsset(pickerLogo)
    : asset.isNative
      ? NATIVE_LOGOS[asset.chainId]
      : undefined;
  const chainIcon = showChain ? CHAIN_ICONS[asset.chainId] : undefined;
  const badgeSize = Math.round(size * (pickerKey ? 0.35 : 0.42));
  const badgeOffset = pickerKey ? -4 : -3;

  return (
    <View style={{ width: size, height: size }}>
      {localLogo ? (
        <Image
          source={localLogo}
          style={{ width: size, height: size, borderRadius: pickerLogo ? 0 : size / 2 }}
          contentFit="contain"
          alt={`${asset.symbol} icon`}
          cachePolicy="memory-disk"
        />
      ) : (
        <RenderTokenIcon
          tokenIcon={getTokenIcon({
            logoUrl: asset.logoURI,
            tokenSymbol: asset.symbol,
            size,
          })}
          size={size}
          tokenName={asset.symbol}
        />
      )}
      {chainIcon && (
        <View
          className="absolute rounded-full border-2 border-card bg-card"
          style={{ right: badgeOffset, bottom: badgeOffset }}
        >
          <Image
            source={chainIcon}
            style={{ width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }}
            contentFit="contain"
          />
        </View>
      )}
    </View>
  );
};

export default memo(SwapAssetLogo);
