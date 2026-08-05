import { View } from 'react-native';

import CoinApyPill from '@/components/Coin/CoinApyPill';
import CoinBackButton from '@/components/Coin/CoinBackButton';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { CoinBreakdown } from '@/hooks/useCoinBreakdown';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { TokenVault } from '@/lib/vaults';

type CoinSummaryProps = {
  token: TokenBalance | undefined;
  breakdown: CoinBreakdown | undefined;
  tokenVault: TokenVault | undefined;
};

const ICON_SIZE = 52;

/** Gap the design leaves between the top of the back button and the token icon. */
const ICON_TOP_OFFSET = 36;

/** Coin identity and total balance, with the back button floated over it. */
const CoinSummary = ({ token, breakdown, tokenVault }: CoinSummaryProps) => {
  const symbol = breakdown?.symbol ?? token?.contractTickerSymbol ?? '';

  return (
    <View className="items-center gap-2" style={{ paddingTop: ICON_TOP_OFFSET }}>
      <View className="absolute left-0 top-0 z-10">
        <CoinBackButton />
      </View>

      <RenderTokenIcon
        tokenIcon={getTokenIcon({
          logoUrl: token?.logoUrl,
          tokenSymbol: token?.contractTickerSymbol,
          size: ICON_SIZE,
        })}
        size={ICON_SIZE}
        tokenName={token?.contractTickerSymbol}
        priority="high"
      />

      <Text className="text-base font-semibold text-foreground/70">
        {token?.contractName || symbol}
      </Text>

      <Text className="text-3.5xl font-semibold">
        {formatNumber(breakdown?.totalBalance ?? 0, 6, 0)} {symbol}
      </Text>

      <Text className="text-base font-semibold text-foreground/70">
        ${formatNumber(breakdown?.totalBalanceUSD ?? 0, 2, 2)}
      </Text>

      <CoinApyPill tokenVault={tokenVault} className="mt-1" />
    </View>
  );
};

export default CoinSummary;
