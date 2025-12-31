import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { formatNumber } from '@/lib/utils';

const SavingDepositTitle = () => {
  const { maxAPY, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();
  const total = 1000;
  const earnings = (total * (maxAPY ?? 0)) / 100;

  return (
    <Text className="text-center md:text-start text-2xl md:text-4.5xl md:leading-[3rem] font-semibold max-w-sm md:max-w-xl mx-auto md:mx-0">
      Earn{' '}
      {isMaxAPYsLoading ? (
        <Skeleton className="w-14 md:w-24 h-6 md:h-10 bg-purple/50" />
      ) : (
        <Text className="text-2xl md:text-4.5xl text-brand font-semibold underline underline-offset-4">
          ${formatNumber(earnings, 2)}
        </Text>
      )}{' '}
      per year for every ${formatNumber(total, 0, 0)} you keep in Solid
    </Text>
  );
};

export default SavingDepositTitle;
