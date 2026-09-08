import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Href, router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useXStockPrices } from '@/hooks/useXStockPrices';
import { useXStocksTokens, XStockToken } from '@/hooks/useXStocksTokens';

import { EarnAssetRow } from './EarnAssetRow';
import {
  EARN_CATEGORIES,
  type EarnCategoryKey,
  formatAssetName,
  getAssetSector,
  selectCategoryTokens,
} from './earnCatalog';

const DISCLAIMER =
  'Tokenized assets are issued by Backed Finance and held in your own wallet. ' +
  'Availability depends on your region, and prices can go down as well as up.';

/**
 * Every entry point lands on the Stocks screen, which owns buy/sell. Naming a
 * stock opens its buy flow directly; the browse CTA leaves the picker open.
 */
const openStocks = (token?: XStockToken) =>
  router.push(
    token ? ({ pathname: '/stocks', params: { ticker: token.symbol } } as Href) : path.STOCKS,
  );

/** Figma — the "Earn more" catalog beneath the Earn vault grid. */
export const EarnMoreSection = () => {
  const [activeCategory, setActiveCategory] = useState<EarnCategoryKey>('popular');
  const { tokens } = useXStocksTokens();

  const previewTokens = useMemo(
    () => selectCategoryTokens(tokens, activeCategory),
    [tokens, activeCategory],
  );
  const prices = useXStockPrices(previewTokens.map(token => token.symbol));

  return (
    <View className="mt-8">
      <Text className="text-[18px] font-semibold leading-6 text-white">Earn more</Text>
      <Text className="mt-1 text-[14px] leading-5 text-white/50">
        Buy, sell and use as collateral
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 py-4"
      >
        {EARN_CATEGORIES.map(category => {
          const isActive = category.key === activeCategory;

          return (
            <Pressable
              key={category.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => setActiveCategory(category.key)}
              className={`h-9 justify-center rounded-full px-4 transition-all active:opacity-80 ${
                isActive ? 'bg-white' : 'bg-[#1C1C1C]'
              }`}
            >
              <Text
                className={`text-[14px] font-medium leading-4 ${
                  isActive ? 'text-black' : 'text-white/60'
                }`}
              >
                {category.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View>
        {previewTokens.map(token => (
          <EarnAssetRow
            key={token.symbol}
            ticker={token.symbol}
            name={formatAssetName(token.symbol, token.name)}
            sector={getAssetSector(token.symbol)}
            logoUrl={token.logoUrl}
            price={prices[token.symbol]}
            onPress={() => openStocks(token)}
          />
        ))}
      </View>

      <Pressable
        accessibilityLabel={`Browse all ${tokens.length} assets`}
        accessibilityRole="button"
        onPress={() => openStocks()}
        className="mt-4 h-[52px] items-center justify-center rounded-2xl bg-[#1C1C1C] transition-all active:scale-[0.98] active:opacity-90"
      >
        <Text className="text-[15px] font-medium leading-5 text-white">
          Browse all {tokens.length} assets
        </Text>
      </Pressable>

      <Text className="mt-4 text-center text-[11px] leading-4 text-white/35">{DISCLAIMER}</Text>
    </View>
  );
};
