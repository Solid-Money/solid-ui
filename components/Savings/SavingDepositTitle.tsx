import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useMaxAPY } from '@/hooks/useAnalytics';

const SavingDepositTitle = () => {
  const { maxAPY, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();

  return (
    <Text className="text-center md:text-start text-2xl md:text-4.5xl md:leading-[3rem] font-medium max-w-sm md:max-w-lg mx-auto md:mx-0">
      Deposit your stablecoins and earn{' '}
      {isMaxAPYsLoading ? (
        <Skeleton className="w-14 md:w-24 h-6 md:h-10 bg-purple/50" />
      ) : (
        <Text className="text-2xl md:text-4.5xl text-brand font-bold underline">
          {maxAPY?.toFixed(2)}%
        </Text>
      )}{' '}
      per year
    </Text>
  );
};

export default SavingDepositTitle;
