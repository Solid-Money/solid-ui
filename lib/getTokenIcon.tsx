import DefaultTokenIcon from '@/components/DefaultTokenIcon';
import { getAsset } from './assets';
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
      return {
        type: 'image',
        source: getAsset('images/usdc-4x.png'),
      };
    case 'USDT':
      return {
        type: 'image',
        source: getAsset('images/usdt.png'),
      };
    case 'WETH':
    case 'ETH':
      return {
        type: 'image',
        source: getAsset('images/eth.png'),
      };
    case 'FUSE':
    case 'WFUSE':
    case 'SOFUSE':
      return {
        type: 'image',
        source: getAsset('images/fuse-4x.png'),
      };
    case 'SOUSD':
      return {
        type: 'image',
        source: getAsset('images/sousd-4x.png'),
      };
    default:
      return {
        type: 'component',
        component: <DefaultTokenIcon size={size} symbol={tokenSymbol || 'T'} />,
      };
  }
};

export default getTokenIcon;
