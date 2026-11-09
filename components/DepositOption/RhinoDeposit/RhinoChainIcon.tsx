import React from 'react';
import { ImageSourcePropType, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import { getAsset } from '@/lib/assets';

/**
 * Logos for the non-EVM rhino.fi chains the repo already has artwork for. An
 * EVM chain the app lists itself (Ethereum, Arbitrum, …) is drawn with that
 * row's own logo, found by `chainId`. Every other chain (Tron, Avalanche, Celo,
 * Gnosis, Mantle, Plasma, Kaia, Tempo, Arc) is drawn as its initial until its
 * logo is added here.
 */
const RHINO_CHAIN_ICONS: Record<string, ImageSourcePropType> = {
  OPTIMISM: getAsset('images/op.png'),
  SOLANA: getAsset('images/sol.png'),
  BITCOIN: getAsset('images/btc.png'),
};

export const getRhinoChainIcon = (
  chain: string,
  chainId?: number,
): ImageSourcePropType | undefined =>
  RHINO_CHAIN_ICONS[chain] ??
  (chainId !== undefined ? getBridgeChain(chainId)?.icon : undefined) ??
  undefined;

type RhinoChainIconProps = {
  /** rhino.fi chain id, e.g. `TRON`. */
  chain: string;
  /** Its EVM chain id, when it has one: an app-listed chain keeps its own logo. */
  chainId?: number;
  /** Display name; its first letter stands in for a missing logo. */
  name: string;
  size: number;
};

/** A rhino.fi chain's logo, or its initial in a circle the same size. */
const RhinoChainIcon = ({ chain, chainId, name, size }: RhinoChainIconProps) => {
  const icon = getRhinoChainIcon(chain, chainId);
  const style = { width: size, height: size, borderRadius: size / 2 };

  if (icon) return <Image source={icon} style={style} contentFit="cover" />;

  return (
    <View className="items-center justify-center bg-[#333333]" style={style}>
      <Text
        className="font-semibold text-white"
        style={{ fontSize: Math.round(size * 0.45), lineHeight: Math.round(size * 0.55) }}
      >
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
};

export default RhinoChainIcon;
