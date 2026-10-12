import React, { memo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { CHAIN_ICONS } from '@/constants/chains';
import { getAsset } from '@/lib/assets';
import getTokenIcon from '@/lib/getTokenIcon';
import { SwapAsset } from '@/lib/types/lifi-swap';

/** Native currencies have no catalogue logo; these are the app's own marks. */
const NATIVE_LOGOS: Record<number, ReturnType<typeof getAsset>> = {
  [fuse.id]: getAsset('images/fuse.png'),
  [mainnet.id]: getAsset('images/eth.png'),
  [base.id]: getAsset('images/eth.png'),
  [arbitrum.id]: getAsset('images/eth.png'),
  [polygon.id]: getAsset('images/polygon.png'),
  [bsc.id]: getAsset('images/bsc.png'),
};

interface SwapAssetLogoProps {
  asset: Pick<SwapAsset, 'chainId' | 'symbol' | 'logoURI' | 'isNative'> | undefined;
  size: number;
  /** The network badge in the corner. Off where the chain is already named. */
  showChain?: boolean;
}

const SwapAssetLogo = ({ asset, size, showChain = true }: SwapAssetLogoProps) => {
  if (!asset) {
    return (
      <View
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#2a2a2a' }}
      />
    );
  }

  const nativeLogo = asset.isNative ? NATIVE_LOGOS[asset.chainId] : undefined;
  const chainIcon = showChain ? CHAIN_ICONS[asset.chainId] : undefined;
  const badgeSize = Math.round(size * 0.42);

  return (
    <View style={{ width: size, height: size }}>
      {nativeLogo ? (
        <Image
          source={nativeLogo}
          style={{ width: size, height: size, borderRadius: size / 2 }}
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
          style={{ right: -3, bottom: -3 }}
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
