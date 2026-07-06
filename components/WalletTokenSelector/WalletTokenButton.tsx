import { Pressable, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';

interface WalletTokenButtonProps {
  selectedToken: TokenBalance | null;
  onPress: () => void;
}

/**
 * Inline token selector button showing the selected token with chain name,
 * or a "Select token" placeholder. Reused by withdraw and deposit forms.
 */
const WalletTokenButton = ({ selectedToken, onPress }: WalletTokenButtonProps) => {
  return (
    <Pressable
      className="h-12 flex-row items-center gap-1.5 rounded-full bg-foreground/10 px-3 web:hover:bg-foreground/20"
      onPress={onPress}
    >
      {selectedToken ? (
        <>
          <RenderTokenIcon
            tokenIcon={getTokenIcon({
              logoUrl: selectedToken.logoUrl,
              tokenSymbol: selectedToken.contractTickerSymbol,
              size: 28,
            })}
            size={28}
          />
          <View className="flex-col">
            <Text className="text-lg/5 font-semibold">
              {selectedToken.contractTickerSymbol}
            </Text>
            <Text className="text-sm/4 font-medium opacity-50">
              {getBridgeChain(selectedToken.chainId)?.name}
            </Text>
          </View>
          <ChevronDown size={20} color="white" />
        </>
      ) : (
        <>
          <View className="h-6 w-6 rounded-full bg-primary/20" />
          <Text className="text-lg font-semibold text-muted-foreground">Select token</Text>
          <ChevronDown size={20} color="white" />
        </>
      )}
    </Pressable>
  );
};

export default WalletTokenButton;
