import { Image } from 'expo-image';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TOKEN_IMAGES } from '@/constants/tokens';
import { useTokenSelector } from '@/hooks/useToken';
import useUser from '@/hooks/useUser';
import { Token } from '@/lib/types';

type TokenSelectorProps = {
  tokens: Token[];
  setSelectedToken: (token: Token) => void;
  setOpen?: (open: boolean) => void;
};

const TokenSelector = ({ tokens, setSelectedToken, setOpen }: TokenSelectorProps) => {
  const { user } = useUser();
  const { tokensWithBalance } = useTokenSelector({ tokens, safeAddress: user?.safeAddress });

  const handleTokenClick = (token: Token) => {
    setSelectedToken(token);
    setOpen?.(false);
  };

  return (
    <View className="flex flex-col gap-2.5">
      {!tokensWithBalance.length &&
        Array.from({ length: tokens.length }).map((_, index) => (
          <Skeleton
            key={index}
            className="bg-primary/10 border-primary/0 rounded-2xl justify-between h-16 px-4"
          />
        ))}
      {tokensWithBalance.map(token => (
        <Button
          key={token.address}
          variant="secondary"
          className="bg-primary/10 border-primary/0 rounded-2xl justify-between h-16 px-4"
          disabled={token.isComingSoon}
          onPress={() => handleTokenClick(token)}
        >
          <View className="flex-row items-center gap-2">
            <Image source={TOKEN_IMAGES[token.imageId]} alt={token.name} className="w-8 h-8" />
            <View className="flex-col items-start gap-0.5">
              <Text className="text-lg font-bold">{token.name}</Text>
              <Text className="text-sm opacity-40">On ethereum</Text>
            </View>
          </View>
          {token.isComingSoon ? (
            <Text className="text-base">Coming soon</Text>
          ) : (
            <View className="flex-col items-end gap-0.5">
              <Text className="text-lg font-bold">
                $
                {!token.balanceUSD
                  ? '0'
                  : token.balanceUSD < 0.001
                    ? '<0.001'
                    : token.balanceUSD.toFixed(3)}
              </Text>
              <Text className="text-sm opacity-40">
                {!token.balance ? '0' : token.balance < 0.001 ? '<0.001' : token.balance.toFixed(3)}
              </Text>
            </View>
          )}
        </Button>
      ))}
    </View>
  );
};

export default TokenSelector;
