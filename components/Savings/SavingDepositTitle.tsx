import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { VAULTS } from '@/constants/vaults';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useSavingStore } from '@/store/useSavingStore';

const SavingDepositTitle = () => {
  const { selectedVault } = useSavingStore();
  const { maxAPY, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();

  return (
    <Text className="mx-auto max-w-sm text-center text-2xl font-semibold md:mx-0 md:max-w-lg md:text-start md:text-4.5xl md:leading-[3rem]">
      Deposit your {VAULTS[selectedVault].name} and earn{' '}
      {isMaxAPYsLoading ? (
        <Skeleton className="h-6 w-14 bg-purple/50 md:h-10 md:w-24" />
      ) : (
        <Text className="text-2xl font-bold text-brand underline md:text-4.5xl">
          {maxAPY?.toFixed(2)}%
        </Text>
      )}{' '}
      per year
    </Text>
  );
};

export default SavingDepositTitle;
