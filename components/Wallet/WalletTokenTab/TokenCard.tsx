import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { formatUnits } from 'viem';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';
import { compactNumberFormat, isSoUSDEthereum } from '@/lib/utils';

interface TokenCardProps {
  token: TokenBalance;
  onPress: () => void;
}

const TokenCard = memo(
  ({ token, onPress }: TokenCardProps) => {
    const balance = Number(formatUnits(BigInt(token.balance || '0'), token.contractDecimals));
    const balanceUSD = balance * (token.quoteRate || 0);

    const tokenIcon = getTokenIcon({
      logoUrl: token.logoUrl,
      tokenSymbol: token.contractTickerSymbol,
      size: 40,
    });

    return (
      <Pressable
        className="flex-row items-center justify-between p-4 py-5 bg-[#1C1C1C] rounded-[20px] mb-2"
        onPress={onPress}
      >
        <View className="flex-row items-center gap-3">
          <RenderTokenIcon tokenIcon={tokenIcon} size={40} />
          <View>
            <Text className="font-bold text-lg">{token.contractTickerSymbol || 'Unknown'}</Text>
            {isSoUSDEthereum(token.contractAddress) && (
              <View className="bg-accent rounded-full px-2 py-1 flex-row items-center gap-2 w-fit">
                <Text className="text-xs font-semibold">Ready to withdraw</Text>
              </View>
            )}
          </View>
        </View>

        <View className="flex-row items-center gap-3">
          <View className="items-end">
            <Text className="font-bold text-base">{compactNumberFormat(balance)}</Text>
            <Text className="text-sm font-medium text-muted-foreground">
              ${compactNumberFormat(balanceUSD)}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.token.contractAddress === next.token.contractAddress &&
    prev.token.balance === next.token.balance &&
    prev.token.quoteRate === next.token.quoteRate,
);

TokenCard.displayName = 'TokenCard';

export default TokenCard;
