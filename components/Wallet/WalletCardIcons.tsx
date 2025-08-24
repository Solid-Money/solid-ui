import { View } from 'react-native';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';

type WalletCardIconsProps = {
  tokens: TokenBalance[];
  size?: number;
};

const WalletCardIcons = ({ tokens, size = 28 }: WalletCardIconsProps) => {
  return (
    <View className="flex-row">
      {tokens?.map((token, index) => (
        <View
          key={token.contractAddress}
          className="-ml-2"
          style={{
            zIndex: tokens.length - index,
          }}
        >
          <RenderTokenIcon
            tokenIcon={getTokenIcon({
              logoUrl: token.logoUrl,
              tokenSymbol: token.contractTickerSymbol,
              size,
            })}
            size={size}
          />
        </View>
      ))}
    </View>
  );
};

export default WalletCardIcons;
