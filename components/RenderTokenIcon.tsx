import { Image } from 'expo-image';

import { TokenIcon } from '@/lib/types';

interface RenderTokenIconProps {
  tokenIcon: TokenIcon;
  size?: number;
  tokenName?: string;
}

const RenderTokenIcon = ({ tokenIcon, size = 24, tokenName }: RenderTokenIconProps) => {
  return tokenIcon.type === 'image' ? (
    <Image
      source={tokenIcon.source}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      alt={tokenName ? `${tokenName} token icon` : 'Token icon'}
    />
  ) : (
    tokenIcon.component
  );
};

export default RenderTokenIcon;
