import { ImageSourcePropType } from "react-native";

export const protocols = {
  Pendle: 'Pendle',
  Morpho: 'Morpho',
};

export const protocolsImages: Record<string, ImageSourcePropType> = {
  [protocols.Pendle]: require('@/assets/images/pendle.png'),
  [protocols.Morpho]: require('@/assets/images/morpho.png'),
};
