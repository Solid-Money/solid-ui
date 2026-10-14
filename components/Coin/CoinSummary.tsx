import { Pressable, View } from 'react-native';
import { Href, router } from 'expo-router';

import CoinBackButton from '@/components/Coin/CoinBackButton';
import { EarnChip } from '@/components/Earn/EarnChips';
import YieldIcon from '@/components/Earn/YieldIcon';
import { formatShareRate, openYieldProduct } from '@/components/Earn/yieldProducts';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { CoinBreakdown } from '@/hooks/useCoinBreakdown';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import getTokenIcon from '@/lib/getTokenIcon';
import { formatTokenAmount } from '@/lib/portfolio';
import { TokenBalance } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { TokenVault } from '@/lib/vaults';

type CoinSummaryProps = {
  token: TokenBalance | undefined;
  breakdown: CoinBreakdown | undefined;
  /**
   * Set when the coin is a share token (soUSD / soETH / soFUSE), from `getEarningTokenVault`
   * so a production share seen from a development build counts too. Only shares earn: USDC
   * sitting in the wallet has no APY.
   */
  shareVault: TokenVault | undefined;
};

const ICON_SIZE = 52;

/** Gap the design leaves between the top of the back button and the token icon. */
const ICON_TOP_OFFSET = 36;

/**
 * Figma 28445:4885: the product's APY as a chip and what one share is worth now
 * ("1 soUSD = $1.0830"). The chip opens the product.
 */
const ShareRateRow = ({ shareVault }: { shareVault: TokenVault }) => {
  const { vault } = shareVault;
  const { maxAPY, isAPYsLoading } = useMaxAPY(vault.type);
  const { data: rate } = useVaultExchangeRate(vault.name);
  const rateLabel = formatShareRate(vault.type, rate);

  return (
    <View className="mt-1 flex-row flex-wrap items-center justify-center gap-2">
      {isAPYsLoading ? (
        <Skeleton className="h-7 w-[90px] rounded-full bg-card" />
      ) : maxAPY ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${vault.vaultName}`}
          onPress={() => router.push(openYieldProduct(vault.type) as Href)}
          className="active:opacity-80"
        >
          <EarnChip tone="positive" label={`${formatNumber(maxAPY, 1, 1)}% APY`} />
        </Pressable>
      ) : null}
      {rateLabel ? (
        <Text className="text-[13px] leading-[18px] text-white/50">{rateLabel}</Text>
      ) : null}
    </View>
  );
};

/** Coin identity and total balance, with the back button floated over it. */
const CoinSummary = ({ token, breakdown, shareVault }: CoinSummaryProps) => {
  const symbol = breakdown?.symbol ?? token?.contractTickerSymbol ?? '';
  const total = breakdown?.totalBalance ?? 0;

  return (
    <View className="items-center gap-2" style={{ paddingTop: ICON_TOP_OFFSET }}>
      <View className="absolute left-0 top-0 z-10">
        <CoinBackButton />
      </View>

      {shareVault ? (
        // The product's mark with the live dot: a share is the product's balance, earning.
        <YieldIcon
          vaultType={shareVault.vault.type}
          size={ICON_SIZE}
          badge="live"
          ringColor="#111111"
        />
      ) : (
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
      )}

      <Text className="text-base font-semibold text-foreground/70">
        {shareVault ? symbol : token?.contractName || symbol}
      </Text>

      <Text className="text-3.5xl font-semibold">
        {shareVault ? formatTokenAmount(total) : formatNumber(total, 3, 0)} {symbol}
      </Text>

      <Text className="text-base font-semibold text-foreground/70">
        ${formatNumber(breakdown?.totalBalanceUSD ?? 0, 2, 2)}
      </Text>

      {shareVault ? <ShareRateRow shareVault={shareVault} /> : null}
    </View>
  );
};

export default CoinSummary;
