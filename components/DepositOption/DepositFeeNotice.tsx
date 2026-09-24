import { Text } from '@/components/ui/text';
import { CardProvider } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  DepositFeeProduct,
  formatDepositFeePercent,
  getDepositFeeBps,
} from '@/lib/utils/depositFee';

type DepositFeeNoticeProps = {
  product: DepositFeeProduct;
  /**
   * The card issuer the flow serves. Passed in rather than looked up, because a
   * flow built for one issuer ("Fund your card" is Rain's) has to quote that
   * issuer's fee whatever the issuer query says in the meantime.
   */
  provider: CardProvider | null | undefined;
  /** Chain the deposit is sent on. */
  chainId: number;
  /** Currency being sent. */
  symbol?: string;
  /** Share token a savings deposit mints. */
  vaultToken?: string;
  className?: string;
};

/**
 * The fee line under a deposit address. Renders nothing when the deposit is
 * free; `getDepositFeeBps` decides when that is.
 */
const DepositFeeNotice = ({
  product,
  provider,
  chainId,
  symbol,
  vaultToken,
  className,
}: DepositFeeNoticeProps) => {
  const bps = getDepositFeeBps({ provider, product, chainId, symbol, vaultToken });

  if (!bps) return null;

  return (
    <Text className={cn('text-center text-sm text-white/50', className)}>
      {`${formatDepositFeePercent(bps)} fee will be charged for deposits on this network`}
    </Text>
  );
};

export default DepositFeeNotice;
