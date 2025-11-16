import { ImageSourcePropType } from "react-native";

export const protocolTypes = {
  Pendle: 'Pendle',
  Morpho: 'Morpho',
  AutoFinance: 'AutoFinance',
  Fusion: 'Fusion',
  AvantisLP: 'AvantisLP',
};

export const protocols = {
  Pendle: 'Pendle',
  Morpho: 'Morpho',
  AutoFinance: 'AutoFinance',
  Fusion: 'IPOR Fusion',
  AvantisLP: 'Avantis',
};

export const protocolsImages: Record<string, ImageSourcePropType> = {
  Pendle: require('@/assets/images/pendle.png'),
  Morpho: require('@/assets/images/morpho.png'),
  AutoFinance: require('@/assets/images/auto-finance.jpg'),
  Fusion: require('@/assets/images/ipor-fusion.png'),
  AvantisLP: require('@/assets/images/avantis.png'),
};
