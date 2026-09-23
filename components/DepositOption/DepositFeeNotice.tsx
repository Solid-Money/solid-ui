import { Text } from '@/components/ui/text';
import { useCardProvider } from '@/hooks/useCardProvider';
import { cn } from '@/lib/utils';
import {
  DepositFeeProduct,
  formatDepositFeePercent,
  getDepositFeeBps,
} from '@/lib/utils/depositFee';

type DepositFeeNoticeProps = {
  product: DepositFeeProduct;
  /** Chain the deposit is sent on. */
  chainId: number;
  /** Share token a savings deposit mints. Unused for the card. */
  vaultToken?: string;
  className?: string;
};

/**
 * The fee line under a deposit address. Renders nothing on a chain the deposit
 * is free from; `getDepositFeeBps` decides which chains those are.
 */
const DepositFeeNotice = ({ product, chainId, vaultToken, className }: DepositFeeNoticeProps) => {
  const { provider } = useCardProvider();
  const bps = getDepositFeeBps({ provider, product, chainId, vaultToken });

  if (!bps) return null;

  return (
    <Text className={cn('text-center text-sm text-white/50', className)}>
      {`${formatDepositFeePercent(bps)} fee will be charged for deposits on this network`}
    </Text>
  );
};

export default DepositFeeNotice;
