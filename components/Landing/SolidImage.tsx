import { Image } from 'expo-image';

import { getAsset } from '@/lib/assets';

interface SolidImageProps {
  width?: number;
  height?: number;
}

const SolidImage = ({ width = 201, height = 201 }: SolidImageProps) => {
  return (
    <Image
      source={getAsset('images/solid-dark-purple.png')}
      style={{ width, height }}
      contentFit="contain"
    />
  );
};

export default SolidImage;
