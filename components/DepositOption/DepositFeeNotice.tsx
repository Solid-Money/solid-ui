import { Text } from '@/components/ui/text';
import { useDepositFeeQuote } from '@/hooks/useDepositFeeQuote';
import { CardProvider } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  DepositFeeProduct,
  formatDepositFeePercent,
  getDepositFeeDestinationType,
  getDepositFeeRatePpm,
  resolveDepositFeeRatePpm,
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
  /** Currency being sent. The backend prices the deposit by it. */
  symbol?: string;
  /** Share token a savings deposit mints. */
  vaultToken?: string;
  /**
   * The kind of address the wallet screen minted, which decides what it is
   * charged: `WALLET` unless it was a card one (a Wirex cardholder's dollars
   * on Fuse). Unused by the other flows.
   */
  walletAddress?: 'WALLET' | 'RAIN_CARD';
  className?: string;
};

/**
 * The fee line under a deposit address. Renders nothing when the deposit is
 * free, and nothing until the backend has said at what rate it is not:
 * `getDepositFeeRatePpm` decides which deposits can be charged, and the
 * backend's quote what they pay.
 */
const DepositFeeNotice = ({
  product,
  provider,
  chainId,
  symbol,
  vaultToken,
  walletAddress,
  className,
}: DepositFeeNoticeProps) => {
  const rulePpm = getDepositFeeRatePpm({
    provider,
    product,
    chainId,
    symbol,
    vaultToken,
    walletAddress,
  });
  const { data: quote, isError } = useDepositFeeQuote({
    destinationType: getDepositFeeDestinationType(product, walletAddress),
    chainId,
    symbol,
    provider,
    enabled: rulePpm > 0,
  });
  // No currency means nothing to ask the backend about, which is the same as it
  // not answering: quote the default.
  const ratePpm = resolveDepositFeeRatePpm({ rulePpm, quote, quoteFailed: isError || !symbol });

  if (!ratePpm) return null;

  return (
    <Text className={cn('text-center text-sm text-white/50', className)}>
      {`${formatDepositFeePercent(ratePpm)} fee will be charged for deposits on this network`}
    </Text>
  );
};

export default DepositFeeNotice;
