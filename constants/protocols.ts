import { ImageSourcePropType } from "react-native";

export const protocols = {
  Pendle: 'Pendle',
  Morpho: 'Morpho',
  AutoFinance: 'AutoFinance',
  Fusion: 'IPOR Fusion',
};

export const protocolsImages: Record<string, ImageSourcePropType> = {
  Pendle: require('@/assets/images/pendle.png'),
  Morpho: require('@/assets/images/morpho.png'),
  AutoFinance: require('@/assets/images/auto-finance.jpg'),
  Fusion: require('@/assets/images/ipor-fusion.png'),
};
