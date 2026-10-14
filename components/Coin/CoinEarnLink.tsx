import { Pressable, View } from 'react-native';
import { Href, router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import YieldIcon from '@/components/Earn/YieldIcon';
import { openYieldProduct } from '@/components/Earn/yieldProducts';
import { Text } from '@/components/ui/text';
import { TokenVault } from '@/lib/vaults';

type CoinEarnLinkProps = {
  /** The product a share token belongs to; nothing renders for other coins. */
  shareVault: TokenVault | undefined;
};

/**
 * On a share token's page (soUSD / soETH / soFUSE), the product it belongs to (Figma
 * 28445:4885 "Part of USD Yield"). Withdrawals live there, so this keeps them one tap away.
 */
const CoinEarnLink = ({ shareVault }: CoinEarnLinkProps) => {
  if (!shareVault) return null;
  const { vault } = shareVault;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${vault.vaultName}`}
      onPress={() => router.push(openYieldProduct(vault.type) as Href)}
      className="flex-row items-center gap-[14px] rounded-[20px] bg-card p-4 active:opacity-80"
    >
      <YieldIcon vaultType={vault.type} />
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text className="text-[16px] font-semibold leading-[23px] text-white">
          Part of {vault.vaultName}
        </Text>
        <Text className="text-[14px] leading-5 text-white/60">Withdraw or manage in Earn</Text>
      </View>
      <ChevronRight size={16} strokeWidth={1.6} color="rgba(255,255,255,0.35)" />
    </Pressable>
  );
};

export default CoinEarnLink;
