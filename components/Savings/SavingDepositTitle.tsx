import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { VAULTS } from '@/constants/vaults';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useSavingStore } from '@/store/useSavingStore';

const SavingDepositTitle = () => {
  const selectedVault = useSavingStore(state => state.selectedVault);
  const { maxAPY, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();

  return (
    <Text className="mx-auto max-w-sm text-center text-2xl font-semibold md:mx-0 md:max-w-lg md:text-start md:text-4.5xl md:leading-[3rem]">
      Deposit your {VAULTS[selectedVault].name} and earn{' '}
      {isMaxAPYsLoading ? (
        <Skeleton className="h-6 w-14 bg-purple/50 md:h-10 md:w-24" />
      ) : (
        <Underline
          inline
          textClassName="text-2xl font-bold text-brand md:text-4.5xl"
          borderColor="rgba(148, 242, 127, 1)"
        >
          {maxAPY?.toFixed(2)}%
        </Underline>
      )}{' '}
      per year
    </Text>
  );
};

export default SavingDepositTitle;
