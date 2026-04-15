import { useMemo } from 'react';
import { ImageSourcePropType, View } from 'react-native';
import { Image } from 'expo-image';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { getAsset } from '@/lib/assets';
import { Vault } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

type SupportedToken = {
  symbol: string;
  icon: ImageSourcePropType;
};

const FALLBACK_ICON_BY_SYMBOL: Record<string, ImageSourcePropType> = {
  USDC: getAsset('images/usdc-4x.png'),
};

/**
 * Collect unique icons for the vault's supported tokens across any chain that supports them.
 * Prefers an explicit `icon` from BRIDGE_TOKENS; falls back to the known per-symbol asset.
 */
const getSupportedTokens = (vault: Vault): SupportedToken[] => {
  const config = vault.depositConfig;
  if (!config) return [];

  const seen = new Map<string, SupportedToken>();

  for (const symbol of config.supportedTokens) {
    if (seen.has(symbol)) continue;
    let icon: ImageSourcePropType | undefined;

    for (const chainId of config.supportedChains) {
      const tokenData = BRIDGE_TOKENS[chainId]?.tokens?.[symbol];
      if (tokenData?.icon) {
        icon = tokenData.icon;
        break;
      }
    }

    if (!icon) icon = FALLBACK_ICON_BY_SYMBOL[symbol] ?? getAsset('images/usdc.png');
    seen.set(symbol, { symbol, icon });
  }

  return Array.from(seen.values());
};

type EmptyDepositTokensProps = {
  vault: Vault;
};

const EmptyDepositTokens = ({ vault }: EmptyDepositTokensProps) => {
  const supportedTokens = useMemo(() => getSupportedTokens(vault), [vault]);
  const tokenList = supportedTokens.map(t => t.symbol).join(' or ');

  const setModal = useDepositStore(useShallow(state => state.setModal));

  const handleDepositPress = () => {
    setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
  };

  return (
    <View className="items-center gap-4">
      <View className="mt-12 flex-row items-center">
        {supportedTokens.map((token, index) => (
          <View
            key={token.symbol}
            style={{
              marginLeft: index === 0 ? 0 : -40,
              borderRadius: 999,
              padding: 2,
              backgroundColor: '#1C1C1C',
              zIndex: index === 0 ? 1 : 0,
            }}
          >
            <Image
              source={token.icon}
              alt={token.symbol}
              style={{ width: 90, height: 90, borderRadius: 999 }}
              contentFit="contain"
            />
          </View>
        ))}
      </View>
      <View className="mt-3 items-center gap-1 rounded-2xl px-12">
        <Text className="text-center text-lg font-semibold text-white">
          You don’t have {tokenList} balance
        </Text>
        {tokenList && (
          <Text className="text-center text-sm text-muted-foreground">
            You need to deposit {tokenList} to your wallet in order to continue to deposit to
            savings.
          </Text>
        )}
      </View>
      <Button variant="brand" className="mt-8 h-12 w-full rounded-xl" onPress={handleDepositPress}>
        <Text className="text-base font-bold">Add Funds</Text>
      </Button>
    </View>
  );
};

export default EmptyDepositTokens;
