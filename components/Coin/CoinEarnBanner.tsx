import { Pressable, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { formatUnits, parseUnits } from 'viem';

import { formatYieldAmount, openYieldProduct } from '@/components/Earn/yieldProducts';
import { Text } from '@/components/ui/text';
import { getVaultKey } from '@/constants/withdraw';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useSavingsVaults } from '@/hooks/useSavingsVaults';
import { formatTokenAmount, portfolioAssetId } from '@/lib/portfolio';
import { TokenBalance, Vault, VaultType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatTokenUnits, sumTokenUnits, TokenUnits } from '@/lib/utils/tokenUnits';
import { getVaultCurrencySymbol } from '@/lib/vaultCurrency';
import {
  getAllowedTokensForChain,
  getVaultDepositConfig,
  getVaultDepositToken,
  LIVE_VAULTS,
} from '@/lib/vaults';

const EARN_BANNER_SYMBOLS = ['USDC', 'USDT', 'EURC', 'ETH'];
const EARN_BANNER_VAULTS = LIVE_VAULTS.filter(vault =>
  [VaultType.USDC, VaultType.EUR, VaultType.ETH].includes(vault.type),
);
const SLIM_BANNER_BREAKPOINT = 390;

type EarnOffer = {
  vault: Vault;
  symbol: string;
  balance: TokenUnits;
  balanceUsd: number;
};

const getEarnOffer = (token: TokenBalance, tokens: TokenBalance[]): EarnOffer | undefined => {
  const assetId = portfolioAssetId(token);
  const family = tokens.filter(held => portfolioAssetId(held) === assetId);

  for (const vault of EARN_BANNER_VAULTS) {
    const { supportedChains } = getVaultDepositConfig(vault);
    const balances: TokenUnits[] = [];
    let offerSymbol: string | undefined;
    let balanceUsd = 0;

    for (const held of family) {
      if (!supportedChains.includes(held.chainId)) continue;

      // Match the deposit contract as well as the chain. A ticker can name
      // several contracts, including on chains where Yield accepts only one.
      const symbol = getAllowedTokensForChain(held.chainId, vault).find(
        key =>
          EARN_BANNER_SYMBOLS.includes(key) &&
          getVaultDepositToken(held.chainId, key)?.address.toLowerCase() ===
            held.contractAddress.toLowerCase(),
      );
      if (!symbol) continue;

      const raw = BigInt(held.balance || '0');
      if (raw <= 0n) continue;
      const decimals = held.contractDecimals;
      balances.push({ raw, decimals });
      offerSymbol ??= symbol;
      if (vault.type === VaultType.ETH) {
        balanceUsd += Number(formatUnits(raw, decimals)) * (held.quoteRate ?? 0);
      }
    }

    if (offerSymbol)
      return { vault, symbol: offerSymbol, balance: sumTokenUnits(balances), balanceUsd };
  }
};

/** Figma 31247:16253 and 31247:16245. */
const EarnBannerRow = ({ vault, symbol, balance, balanceUsd }: EarnOffer) => {
  const { width } = useWindowDimensions();
  const { maxAPY } = useMaxAPY(vault.type);
  const { vaults } = useSavingsVaults();
  const vaultKey = getVaultKey(vault.vaultToken);
  const savings = vaults.find(holding => holding.key === vaultKey);
  const name = vault.vaultName;
  const slim = width < SLIM_BANNER_BREAKPOINT;
  const iconSize = slim ? 16 : 18;
  const apyText = Number.isFinite(maxAPY) && maxAPY > 0 ? maxAPY.toFixed(1) : '0.0';
  const apyTenths = parseUnits(apyText, 1);
  const apyLabel = apyTenths > 0n ? `${apyText}%` : undefined;
  // APY is in tenths of a percent, so the product has three extra decimal places.
  const yearlyYield = { raw: balance.raw * apyTenths, decimals: balance.decimals + 3 };
  const isEth = vault.type === VaultType.ETH;
  const meetsEstimateMinimum = isEth
    ? (balanceUsd * Number(apyText)) / 100 >= 1
    : yearlyYield.raw >= 10n ** BigInt(yearlyYield.decimals);

  let subtitle = `Put it in ${name}`;
  if (savings) {
    subtitle =
      savings.balance > 0
        ? `Add it to your ${formatYieldAmount(savings.balance, vault.type)} in ${name}`
        : `Add it to ${name}`;
  } else if (apyLabel && meetsEstimateMinimum) {
    subtitle += isEth
      ? ` · ~${formatTokenAmount(Number(formatUnits(yearlyYield.raw, yearlyYield.decimals)))} ETH a year`
      : ` · about ${getVaultCurrencySymbol(vault.type)}${formatTokenUnits(yearlyYield, 2, 2)} a year`;
  } else if (apyLabel && vault.type === VaultType.USDC) {
    subtitle += ' · withdraw anytime';
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={`Opens ${name}`}
      onPress={() => router.push(openYieldProduct(vault.type))}
      className={cn(
        'flex-row items-center px-3.5 py-3 active:opacity-80',
        slim ? 'min-h-11 gap-2.5 rounded-[14px] bg-brand/10' : 'gap-3 rounded-2xl bg-brand/[0.08]',
      )}
    >
      <View
        className={cn(
          'shrink-0 items-center justify-center',
          !slim && 'h-9 w-9 rounded-full bg-[#263A22]',
        )}
      >
        <Image
          source={
            slim
              ? require('@/assets/images/coin-earn/trending-up-slim.svg')
              : require('@/assets/images/coin-earn/trending-up.svg')
          }
          style={{ width: iconSize, height: iconSize }}
          contentFit="contain"
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          className={
            slim
              ? 'text-[14px] font-medium leading-[19px] text-brand'
              : 'text-[16px] font-semibold leading-[22px] text-white'
          }
        >
          Earn{' '}
          {apyLabel && !slim ? (
            <Text className="font-semibold text-brand web:!align-baseline">{apyLabel}</Text>
          ) : (
            (apyLabel ?? 'yield')
          )}
          {savings ? ` on this ${symbol} too` : `${apyLabel ? ' a year' : ''} on your ${symbol}`}
        </Text>
        {!slim && <Text className="text-[14px] leading-5 text-white/[0.65]">{subtitle}</Text>}
      </View>
      <Image
        source={
          slim
            ? require('@/assets/images/coin-earn/chevron-right-slim.svg')
            : require('@/assets/images/coin-earn/chevron-right.svg')
        }
        style={{ width: iconSize, height: iconSize }}
        contentFit="contain"
      />
    </Pressable>
  );
};

const CoinEarnBanner = ({
  token,
  tokens,
}: {
  token: TokenBalance | undefined;
  tokens: TokenBalance[];
}) => {
  const offer = token && getEarnOffer(token, tokens);
  return offer ? <EarnBannerRow {...offer} /> : null;
};

export default CoinEarnBanner;
