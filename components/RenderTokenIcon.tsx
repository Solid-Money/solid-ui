import { Image } from 'react-native';

import { TokenIcon } from '@/lib/types';

const RenderTokenIcon = ({ tokenIcon, size = 24 }: { tokenIcon: TokenIcon; size?: number }) => {
  return tokenIcon.type === 'image' ? (
    <Image
      source={tokenIcon.source}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    tokenIcon.component
  );
};

export default RenderTokenIcon;
