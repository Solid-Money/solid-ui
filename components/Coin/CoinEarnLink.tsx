import { Pressable, View } from 'react-native';
import { Href, router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { TokenBalance } from '@/lib/types';
import { isVaultShareToken, TokenVault } from '@/lib/vaults';

type CoinEarnLinkProps = {
  token: TokenBalance | undefined;
  tokenVault: TokenVault | undefined;
};

/**
 * On a vault share token's page (soUSD / soETH / soFUSE), the way back to its Earn screen,
 * where withdrawals live. The Assets screen opens Earn rows here, so this keeps that reachable.
 */
const CoinEarnLink = ({ token, tokenVault }: CoinEarnLinkProps) => {
  if (!tokenVault || !isVaultShareToken(token?.contractAddress)) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Withdraw or manage in Earn"
      onPress={() =>
        router.push({ pathname: '/savings', params: { vault: tokenVault.vault.type } } as Href)
      }
      className="flex-row items-center justify-between gap-3 rounded-twice bg-card px-5 py-4 active:opacity-80"
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold">Withdraw or manage in Earn</Text>
        <Text className="text-sm text-muted-foreground">
          {tokenVault.vault.vaultToken} is your {tokenVault.vault.vaultName} balance
        </Text>
      </View>
      <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
    </Pressable>
  );
};

export default CoinEarnLink;
