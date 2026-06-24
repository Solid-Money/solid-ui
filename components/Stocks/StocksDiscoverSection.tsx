import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useXStockPrices } from '@/hooks/useXStockPrices';
import { useXStocksTokens, XStockToken } from '@/hooks/useXStocksTokens';

import StockRow from './StockRow';

type StocksDiscoverSectionProps = {
  compact?: boolean;
  onStockPress: (token: XStockToken) => void;
  onSearchPress?: () => void;
};

type CategoryKey = 'trending' | 'tech' | 'etf' | 'energy';

const CATEGORIES: { label: string; value: CategoryKey }[] = [
  { label: 'Trending', value: 'trending' },
  { label: 'Tech', value: 'tech' },
  { label: 'ETFs', value: 'etf' },
  { label: 'Energy', value: 'energy' },
];

const CATEGORY_TICKERS: Record<CategoryKey, string[]> = {
  trending: [
    'AAPLx', 'NVDAx', 'MSFTx', 'TSLAx', 'AMZNx', 'METAx', 'GOOGLx',
    'SPCXx', 'COINx', 'PLTRx', 'MSTRx', 'SPYx', 'QQQx',
  ],
  tech: [
    'AAPLx', 'NVDAx', 'MSFTx', 'GOOGLx', 'METAx', 'AMZNx', 'TSLAx',
    'AMDx', 'AVGOx', 'TSMx', 'INTCx', 'CSCOx', 'CRMx', 'ORCLx',
    'ADBEx', 'NETx', 'CRWDx', 'PLTRx', 'COINx', 'HOODx', 'MUx', 'SMCIx', 'DELLx',
  ],
  etf: [
    'SPYx', 'QQQx', 'VOOx', 'IWMx', 'SMHx', 'SOXXx',
    'VTIx', 'VTx', 'TQQQx', 'SOXLx', 'VGKx', 'VXUSx', 'IJRx',
  ],
  energy: [
    'XOMx', 'CVXx', 'XLEx', 'XOPx', 'LNGx', 'GEVx', 'CEGx',
    'PWRx', 'OKLOx', 'GLDx', 'SLVx', 'URAx', 'NLRx',
  ],
};

// Pre-compute the full set of tickers to fetch prices for (union of all categories)
const ALL_CATEGORY_TICKERS = Array.from(
  new Set(Object.values(CATEGORY_TICKERS).flat()),
);

export default function StocksDiscoverSection({
  compact = false,
  onStockPress,
  onSearchPress,
}: StocksDiscoverSectionProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('trending');
  const inputRef = useRef<TextInput>(null);

  const { tokens } = useXStocksTokens();
  const livePrices = useXStockPrices(ALL_CATEGORY_TICKERS);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      // When searching, scan all tokens regardless of category
      return tokens.filter(
        t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
      );
    }
    const allowed = new Set(CATEGORY_TICKERS[activeCategory]);
    // Preserve order defined in CATEGORY_TICKERS
    const orderedMap = new Map(tokens.map(t => [t.symbol, t]));
    return CATEGORY_TICKERS[activeCategory]
      .map(sym => orderedMap.get(sym))
      .filter((t): t is XStockToken => !!t && allowed.has(t.symbol));
  }, [tokens, query, activeCategory]);

  const displayTokens = compact ? filtered.slice(0, 4) : filtered;

  function handleClear() {
    setQuery('');
    inputRef.current?.focus();
  }

  if (compact) {
    return (
      <View className="gap-3 pt-3">
        <View className="flex-row items-center justify-between px-5">
          <Text className="text-lg font-semibold text-white">Discover</Text>
          <Pressable onPress={onSearchPress} className="active:opacity-70">
            <Text className="text-sm font-semibold text-[#94f27f]">Search</Text>
          </Pressable>
        </View>
        <View className="px-2">
          {displayTokens.map(token => (
            <StockRow
              key={token.symbol}
              variant="discover"
              ticker={token.symbol}
              name={token.name}
              logoColor="#1c1c1c"
              logoUrl={token.logoUrl}
              price={livePrices[token.symbol] ?? 0}
              changePercent={0}
              sparklineTrend="up"
              onPress={() => onStockPress(token)}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View className="gap-3 pt-5">
      {/* Search bar */}
      <Pressable
        onPress={() => inputRef.current?.focus()}
        className="mx-5 flex-row items-center gap-3 rounded-[12px] bg-[#1c1c1c] px-3 py-3"
      >
        <Search size={20} color="#808080" />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search stocks..."
          placeholderTextColor="#808080"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="never"
          className="flex-1 bg-transparent text-sm text-white web:focus:outline-none"
        />
        {query.length > 0 && (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            className="h-6 w-6 items-center justify-center rounded-full bg-[#2a2a2a] active:opacity-70"
          >
            <X size={12} color="white" />
          </Pressable>
        )}
      </Pressable>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-5"
        keyboardShouldPersistTaps="handled"
      >
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.value;
          return (
            <Pressable
              key={cat.value}
              onPress={() => setActiveCategory(cat.value)}
              className={`rounded-full px-3 py-2 active:opacity-70 ${isActive ? 'bg-[#2C2C2C]' : ''}`}
            >
              <Text
                className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-white/50'}`}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Results list */}
      <View className="px-2">
        {displayTokens.map(token => (
          <StockRow
            key={token.symbol}
            variant="discover"
            ticker={token.symbol}
            name={token.name}
            logoColor="#1c1c1c"
            logoUrl={token.logoUrl}
            price={livePrices[token.symbol] ?? 0}
            changePercent={0}
            sparklineTrend="up"
            onPress={() => onStockPress(token)}
          />
        ))}
        {displayTokens.length === 0 && (
          <View className="items-center py-8">
            <Text className="text-sm text-[#808080]">No stocks found</Text>
          </View>
        )}
      </View>
    </View>
  );
}
