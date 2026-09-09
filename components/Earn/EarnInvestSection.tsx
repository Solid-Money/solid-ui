import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Href, router } from 'expo-router';
import { Search, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useXStockPrices } from '@/hooks/useXStockPrices';
import { useXStocksTokens, XStockToken } from '@/hooks/useXStocksTokens';

import { EarnAssetRow } from './EarnAssetRow';
import {
  EARN_CATEGORIES,
  EARN_PREVIEW_COUNT,
  type EarnCategoryKey,
  formatAssetName,
  getAssetSector,
  searchTokens,
  selectCategoryTokens,
} from './earnCatalog';

const DISCLAIMER =
  'Tokenized assets carry market risk and can lose value. ' +
  'Availability depends on your region. Not investment advice.';

/**
 * Every entry point lands on the Stocks screen, which owns buy/sell. Naming a
 * stock opens its buy flow directly; the browse CTA leaves the picker open.
 */
const openStocks = (token?: XStockToken) =>
  router.push(
    token ? ({ pathname: '/stocks', params: { ticker: token.symbol } } as Href) : path.STOCKS,
  );

/** Figma — the tokenized-asset catalog beneath the Earn vault tiles. */
export const EarnInvestSection = () => {
  const [activeCategory, setActiveCategory] = useState<EarnCategoryKey>('popular');
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  const { tokens } = useXStocksTokens();

  // Searching scans the whole catalog; browsing stays within the active
  // category's curated picks.
  const visibleTokens = useMemo(
    () =>
      isSearching && query.trim()
        ? searchTokens(tokens, query, EARN_PREVIEW_COUNT)
        : selectCategoryTokens(tokens, activeCategory),
    [tokens, isSearching, query, activeCategory],
  );

  const prices = useXStockPrices(visibleTokens.map(token => token.symbol));

  const openSearch = () => {
    setIsSearching(true);
    // Focus lands after the input mounts on the next frame.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closeSearch = () => {
    setIsSearching(false);
    setQuery('');
  };

  return (
    <View className="mt-8">
      <Text className="text-[18px] font-semibold leading-6 text-white">Invest</Text>
      <Text className="mt-1 text-[14px] leading-5 text-white/50">
        Buy, sell and use as collateral
      </Text>

      {isSearching ? (
        <View className="my-4 h-10 flex-row items-center gap-2 rounded-full bg-[#1C1C1C] px-4">
          <Search size={16} color="rgba(255,255,255,0.5)" />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search assets"
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            className="flex-1 bg-transparent text-[14px] text-white web:focus:outline-none"
          />
          <Pressable
            accessibilityLabel="Close search"
            accessibilityRole="button"
            onPress={closeSearch}
            hitSlop={8}
            className="active:opacity-70"
          >
            <X size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        </View>
      ) : (
        <View className="my-4 flex-row items-center gap-2">
          <Pressable
            accessibilityLabel="Search assets"
            accessibilityRole="button"
            onPress={openSearch}
            className="size-9 items-center justify-center rounded-full bg-[#1C1C1C] transition-all active:opacity-70"
          >
            <Search size={16} color="rgba(255,255,255,0.6)" />
          </Pressable>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
            keyboardShouldPersistTaps="handled"
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
                  {/* Colour set inline, not by class: `Text` merges its own
                      base `text-foreground` with this one, and that resolution
                      has bitten this codebase before — see the `brand` note in
                      ui/button.tsx, where the label intermittently came out
                      white on a light background. A style wins outright. */}
                  <Text
                    className="text-[14px] font-medium leading-4"
                    style={{ color: isActive ? '#000000' : 'rgba(255, 255, 255, 0.6)' }}
                  >
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* The rows group into one panel so the list reads as a single surface
          rather than five items floating on the page background. */}
      <View className="overflow-hidden rounded-[20px] bg-[#1C1C1C] px-4 py-2">
        {visibleTokens.map(token => (
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

        {visibleTokens.length === 0 && (
          <View className="items-center py-6">
            <Text className="text-[14px] text-white/50">No assets match “{query.trim()}”</Text>
          </View>
        )}
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
