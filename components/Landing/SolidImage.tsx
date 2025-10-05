import { Image } from 'expo-image';

interface SolidImageProps {
  width?: number;
  height?: number;
}

const SolidImage = ({ width = 201, height = 201 }: SolidImageProps) => {
  return (
    <Image
      source={require('@/assets/images/solid-dark-purple.png')}
      style={{ width, height }}
      contentFit="contain"
    />
  );
};

export default SolidImage;
