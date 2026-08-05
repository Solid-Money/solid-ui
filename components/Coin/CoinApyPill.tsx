import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';

import Ping from '@/components/Ping';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { cn, formatNumber } from '@/lib/utils';
import { TokenVault } from '@/lib/vaults';
import { useSavingStore } from '@/store/useSavingStore';

type CoinApyPillProps = {
  tokenVault: TokenVault | undefined;
  className?: string;
};

/**
 * "Earning x% APY" pill. Rendered only for yield-bearing assets — a token with no
 * vault has no APY to show. Tapping it opens the matching vault in Savings.
 */
const CoinApyPill = ({ tokenVault, className }: CoinApyPillProps) => {
  const router = useRouter();
  const { maxAPY, isAPYsLoading } = useMaxAPY(tokenVault?.vault.type);

  if (!tokenVault) return null;

  if (isAPYsLoading) {
    return <Skeleton className={cn('h-[35px] w-52 rounded-full bg-card', className)} />;
  }

  if (!maxAPY) return null;

  const openSavings = () => {
    useSavingStore.getState().setSelectedVault(tokenVault.index);
    router.push(path.SAVINGS);
  };

  return (
    <Pressable
      onPress={openSavings}
      className={cn(
        'h-[35px] flex-row items-center gap-2 self-center rounded-full bg-card px-2',
        className,
      )}
    >
      <View className="w-[22px] items-center">
        <Ping />
      </View>
      <Text className="text-base font-semibold text-brand">
        Earning {formatNumber(maxAPY, 1, 1)}% APY
      </Text>
      <ChevronDown color="white" size={18} />
    </Pressable>
  );
};

export default CoinApyPill;
