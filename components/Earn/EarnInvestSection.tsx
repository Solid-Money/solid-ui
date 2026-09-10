import { type ReactNode, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { Href, router } from 'expo-router';
import { Search, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useXStockHoldings } from '@/hooks/useXStockHoldings';
import { useXStockPrices } from '@/hooks/useXStockPrices';
import { useXStocksTokens, XStockToken } from '@/hooks/useXStocksTokens';

import { EarnAssetRow } from './EarnAssetRow';
import {
  EARN_CATEGORIES,
  EARN_PREVIEW_COUNT,
  type EarnCategoryKey,
  formatAssetName,
  formatShares,
  getAssetSector,
  searchTokens,
  selectCategoryTokens,
} from './earnCatalog';

/** Roughly seven rows — tall enough to feel like a list, short enough that the
 *  page's own scroll is still reachable by the time you hit the bottom. */
const EXPANDED_MAX_HEIGHT = 400;

/** Rows added per page while scrolling the expanded list. */
const EXPANDED_PAGE_SIZE = 20;

/** Distance from the bottom at which the next page is pulled in. */
const LOAD_MORE_THRESHOLD = 240;

const DISCLAIMER =
  'Tokenized assets carry market risk and can lose value. ' +
  'Availability depends on your region. Not investment advice.';

/**
 * Trading lives on the Stocks screen, so a row hands it the ticker and the
 * side to open on: a catalog row is something to buy, a position is something
 * the user already owns and would be selling.
 */
const openStock = (token: XStockToken, action: 'buy' | 'sell' = 'buy') =>
  router.push({ pathname: '/stocks', params: { ticker: token.symbol, action } } as Href);

/**
 * Scrolls its own rows once expanded, and is a plain View before that. The
 * collapsed preview is short enough to sit in the page's scroll, and nesting a
 * scroll view around it would capture drags the page should have had.
 */
const ListContainer = ({
  isExpanded,
  onScroll,
  children,
}: {
  isExpanded: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  children: ReactNode;
}) =>
  isExpanded ? (
    <ScrollView
      style={{ maxHeight: EXPANDED_MAX_HEIGHT }}
      nestedScrollEnabled
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View>{children}</View>
  );

/** Figma — the tokenized-asset catalog beneath the Earn vault tiles. */
export const EarnInvestSection = () => {
  const [activeCategory, setActiveCategory] = useState<EarnCategoryKey>('popular');
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [renderLimit, setRenderLimit] = useState(EXPANDED_PAGE_SIZE);
  const inputRef = useRef<TextInput>(null);

  const { tokens } = useXStocksTokens();
  const { holdings, isLoading: isHoldingsLoading } = useXStockHoldings();

  // Holdings carry no logo of their own, so they borrow the catalog's.
  const tokensBySymbol = useMemo(() => new Map(tokens.map(t => [t.symbol, t])), [tokens]);

  // Searching scans the whole catalog; expanding drops the curation entirely
  // and lists everything; otherwise it's the active category's curated picks.
  const listedTokens = useMemo(() => {
    if (isSearching && query.trim()) {
      return searchTokens(tokens, query, isExpanded ? tokens.length : EARN_PREVIEW_COUNT);
    }
    return isExpanded ? tokens : selectCategoryTokens(tokens, activeCategory);
  }, [tokens, isSearching, query, activeCategory, isExpanded]);

  // Only the rows on screen are mounted, and only those get priced — the price
  // hook is one query per ticker, so each page costs only its own new tickers.
  const visibleTokens = useMemo(
    () => (isExpanded ? listedTokens.slice(0, renderLimit) : listedTokens),
    [isExpanded, listedTokens, renderLimit],
  );

  const pricedSymbols = useMemo(
    () => [...new Set([...visibleTokens.map(t => t.symbol), ...holdings.map(h => h.ticker)])],
    [visibleTokens, holdings],
  );
  const prices = useXStockPrices(pricedSymbols);

  const collapse = () => {
    setIsExpanded(false);
    setRenderLimit(EXPANDED_PAGE_SIZE);
  };

  const expand = () => {
    setIsExpanded(true);
    setRenderLimit(EXPANDED_PAGE_SIZE);
  };

  // Picking a category is a request for that curated view, so it drops out of
  // the full listing rather than filtering it.
  const selectCategory = (key: EarnCategoryKey) => {
    setActiveCategory(key);
    collapse();
  };

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const distanceFromEnd = contentSize.height - contentOffset.y - layoutMeasurement.height;

    if (distanceFromEnd < LOAD_MORE_THRESHOLD) {
      setRenderLimit(limit => Math.min(limit + EXPANDED_PAGE_SIZE, listedTokens.length));
    }
  };

  const openSearch = () => {
    setIsSearching(true);
    // Focus lands after the input mounts on the next frame.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closeSearch = () => {
    setIsSearching(false);
    setQuery('');
    collapse();
  };

  // The whole section is for people who already hold something, so it is absent
  // rather than empty for everyone else. Held back while the holdings read is in
  // flight too: appearing and then vanishing reads worse than arriving late.
  if (isHoldingsLoading || holdings.length === 0) return null;

  return (
    <View className="mt-8">
      <Text className="text-[18px] font-semibold leading-6 text-white">Invest</Text>
      <Text className="mt-1 text-[14px] leading-5 text-white/50">Your positions</Text>

      <View className="mt-4 overflow-hidden rounded-[20px] bg-[#1C1C1C] px-4 py-2">
        {holdings.map(holding => {
          const token = tokensBySymbol.get(holding.ticker);
          const price = prices[holding.ticker];

          return (
            <EarnAssetRow
              key={holding.ticker}
              ticker={holding.ticker}
              name={formatAssetName(holding.ticker, holding.name)}
              caption={formatShares(holding.shares)}
              logoUrl={token?.logoUrl}
              value={price === undefined ? undefined : holding.shares * price}
              onPress={() => token && openStock(token, 'sell')}
            />
          );
        })}
      </View>

      <Text className="mt-6 text-[14px] leading-5 text-white/50">
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
                  onPress={() => selectCategory(category.key)}
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
          rather than a handful of items floating on the page background. Only
          the expanded list scrolls: a nested scroll view around the short
          preview would swallow drags meant for the page. */}
      <View className="overflow-hidden rounded-[20px] bg-[#1C1C1C] px-4 py-2">
        <ListContainer isExpanded={isExpanded} onScroll={handleScroll}>
          {visibleTokens.map(token => (
            <EarnAssetRow
              key={token.symbol}
              ticker={token.symbol}
              name={formatAssetName(token.symbol, token.name)}
              caption={getAssetSector(token.symbol)}
              logoUrl={token.logoUrl}
              value={prices[token.symbol]}
              onPress={() => openStock(token)}
            />
          ))}

          {visibleTokens.length === 0 && (
            <View className="items-center py-6">
              <Text className="text-[14px] text-white/50">No assets match “{query.trim()}”</Text>
            </View>
          )}
        </ListContainer>
      </View>

      <Pressable
        accessibilityLabel={isExpanded ? 'Show fewer assets' : `Browse all ${tokens.length} assets`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={isExpanded ? collapse : expand}
        className="mt-4 h-[52px] items-center justify-center rounded-full bg-[#1C1C1C] transition-all active:scale-[0.98] active:opacity-90"
      >
        <Text className="text-[15px] font-medium leading-5 text-white">
          {isExpanded ? 'Show less' : `Browse all ${tokens.length} assets`}
        </Text>
      </Pressable>

      <Text className="mt-4 text-center text-[11px] leading-4 text-white/35">{DISCLAIMER}</Text>
    </View>
  );
};
