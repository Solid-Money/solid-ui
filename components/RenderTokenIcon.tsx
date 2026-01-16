import { Image } from 'expo-image';

import { TokenIcon } from '@/lib/types';

interface RenderTokenIconProps {
  tokenIcon: TokenIcon;
  size?: number;
  tokenName?: string;
  priority?: 'low' | 'normal' | 'high' | null | undefined;
}

const RenderTokenIcon = ({
  tokenIcon,
  size = 24,
  tokenName,
  priority = 'normal',
}: RenderTokenIconProps) => {
  return tokenIcon.type === 'image' ? (
    <Image
      source={tokenIcon.source}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#404040', // Placeholder color while loading
      }}
      alt={tokenName ? `${tokenName} token icon` : 'Token icon'}
      cachePolicy="memory-disk"
      priority={priority}
      transition={150}
    />
  ) : (
    tokenIcon.component
  );
};

export default RenderTokenIcon;
