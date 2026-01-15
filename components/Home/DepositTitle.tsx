import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { formatNumber } from '@/lib/utils';

const DepositTitle = () => {
  const { maxAPY, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();
  const total = 1000;
  const earnings = (total * (maxAPY ?? 0)) / 100;

  return (
    <Text className="mx-auto max-w-sm text-center text-2xl font-semibold md:mx-0 md:max-w-xl md:text-start md:text-4.5xl md:leading-[3rem]">
      Earn{' '}
      {isMaxAPYsLoading ? (
        <Skeleton className="h-6 w-14 bg-purple/50 md:h-10 md:w-24" />
      ) : (
        <Underline
          inline
          textClassName="text-2xl font-semibold text-brand md:text-4.5xl"
          borderColor="rgba(148, 242, 127, 1)"
        >
          ${formatNumber(earnings, 2)}
        </Underline>
      )}{' '}
      per year for every ${formatNumber(total, 0, 0)} you keep in Solid
    </Text>
  );
};

export default DepositTitle;
