import DefaultTokenIcon from '@/components/DefaultTokenIcon';
import { TokenIcon } from './types';

type GetTokenIconProps = {
  logoUrl?: string;
  tokenSymbol?: string;
  size?: number;
};

const getTokenIcon = ({ logoUrl, tokenSymbol, size = 24 }: GetTokenIconProps): TokenIcon => {
  if (logoUrl) {
    return { type: 'image', source: { uri: logoUrl } };
  }

  // Fallback to default token icons based on symbol
  switch (tokenSymbol?.toUpperCase()) {
    case 'USDC':
      return { type: 'image', source: require('@/assets/images/usdc-4x.png') };
    case 'USDT':
      return { type: 'image', source: require('@/assets/images/usdt.png') };
    case 'WETH':
    case 'ETH':
      return { type: 'image', source: require('@/assets/images/eth.png') };
    case 'FUSE':
      return { type: 'image', source: require('@/assets/images/fuse-4x.png') };
    case 'SOUSD':
      return { type: 'image', source: require('@/assets/images/sousd-4x.png') };
    default:
      return {
        type: 'component',
        component: <DefaultTokenIcon size={size} symbol={tokenSymbol || 'T'} />,
      };
  }
};

export default getTokenIcon;
