import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleProp,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Address } from 'viem';

import SwapAssetLogo from '@/components/Swap/SwapAssetLogo';
import { Text } from '@/components/ui/text';
import { CHAIN_ICONS, CHAIN_NAMES } from '@/constants/chains';
import { SWAP_CHAIN_IDS, swapAssetKey } from '@/constants/swapChains';
import { useSwapAssets } from '@/hooks/swap/useSwapAssets';
import { useFuse } from '@/hooks/useFuse';
import useUser from '@/hooks/useUser';
import { SwapAsset, SwapAssetWithBalance } from '@/lib/types/lifi-swap';
import { formatNumber } from '@/lib/utils';

const TokenSelectorView = {
  DEFAULT_LIST: 'DEFAULT_LIST',
  NOT_FOUND: 'NOT_FOUND',
} as const;

type TokenSelectorViewType = (typeof TokenSelectorView)[keyof typeof TokenSelectorView];

const Search = ({
  data,
  onSearch,
  isLoading,
  onQueryChange,
}: {
  data: SwapAssetWithBalance[];
  onSearch: (matchedTokens: SwapAssetWithBalance[]) => void;
  isLoading: boolean;
  onQueryChange?: (query: string | undefined) => void;
}) => {
  const [query, setQuery] = useState<Address | string | undefined>(undefined);
  const [isFocused, setIsFocused] = useState(false);
  const [pulseAnimation] = useState(new Animated.Value(1));

  const fuseOptions = useMemo(
    () => ({
      keys: ['address', 'symbol', 'name'],
      threshold: 0,
    }),
    [],
  );

  const { result, pattern, search } = useFuse<SwapAssetWithBalance>({
    data,
    options: fuseOptions,
  });

  const handleInput = useCallback(
    (input: string | undefined) => {
      setQuery(input);
      onQueryChange?.(input);
    },
    [onQueryChange],
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  useEffect(() => {
    search(query);
  }, [query, search]);

  useEffect(() => {
    onSearch(result);
  }, [result, pattern, onSearch]);

  // Pulse animation for loading
  useEffect(() => {
    if (isLoading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isLoading, pulseAnimation]);

  const isActive = isFocused || (query && query.length > 0);

  return (
    <View className="relative gap-2">
      <View
        style={{
          borderWidth: isActive ? 2.5 : 2,
          borderColor: isActive ? 'rgba(59, 130, 246, 0.8)' : 'rgba(156, 163, 175, 0.3)',
          borderRadius: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isActive ? 6 : 4 },
          shadowOpacity: isActive ? 0.15 : 0,
          shadowRadius: isActive ? 12 : 8,
          elevation: isActive ? 8 : 4,
        }}
        className="bg-card"
      >
        <TextInput
          placeholder={isFocused ? "Try 'USDC' or 'ETH'..." : 'Search tokens...'}
          className="w-full px-4 py-3 text-foreground focus:outline-none"
          onChangeText={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={isFocused ? 'rgba(156, 163, 175, 0.5)' : 'rgba(156, 163, 175, 0.7)'}
          editable={!isLoading}
          selectionColor="rgba(59, 130, 246, 0.3)"
          style={{
            fontWeight: isFocused ? '600' : '500',
            fontSize: 16,
            letterSpacing: 0.2,
          }}
        />
      </View>
      {isLoading && (
        <Animated.View
          style={{
            opacity: pulseAnimation,
            transform: [{ scale: pulseAnimation }],
          }}
          className="absolute right-3 top-3 rounded-full bg-primary/10 p-2"
        >
          <ActivityIndicator size="small" color="#cccccc" />
        </Animated.View>
      )}
      {query && query.length > 0 && !isLoading && (
        <View className="absolute right-3 top-3">
          <View
            className={`rounded-full border p-1 ${
              result.length > 0
                ? 'border-green-500/20 bg-green-500/10'
                : 'border-orange-500/20 bg-orange-500/10'
            }`}
          >
            <Text
              className={`px-2 text-xs font-semibold ${
                result.length > 0 ? 'text-green-600' : 'text-orange-600'
              }`}
            >
              {result.length === 0 ? 'No matches' : `${result.length} found`}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const TokenRow = ({
  asset,
  onSelect,
  locked,
  style,
  index = 0,
}: {
  asset: SwapAssetWithBalance;
  onSelect: (asset: SwapAsset) => void;
  locked: boolean;
  style: StyleProp<ViewStyle>;
  index?: number;
}) => {
  const { user } = useUser();
  const account = user?.safeAddress;
  const [pressAnimation] = useState(new Animated.Value(1));
  const [slideAnimation] = useState(new Animated.Value(0));

  const balance = asset.balance;
  const lock = locked;

  const balanceString = useMemo(() => {
    return formatNumber(balance || 0);
  }, [balance]);

  const balanceUsdString = useMemo(() => {
    return formatNumber(asset.balanceUsd || 0);
  }, [asset.balanceUsd]);

  const isPopular = useMemo(() => {
    return balance > 0;
  }, [balance]);

  // Staggered entrance animation
  useEffect(() => {
    const delay = Math.min(index, 10) * 50; // 50ms delay between each item
    const timer = setTimeout(() => {
      Animated.spring(slideAnimation, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [slideAnimation, index]);

  const handlePressIn = useCallback(() => {
    if (!lock) {
      Animated.spring(pressAnimation, {
        toValue: 0.96,
        tension: 150,
        friction: 4,
        useNativeDriver: true,
      }).start();
    }
  }, [pressAnimation, lock]);

  const handlePressOut = useCallback(() => {
    if (!lock) {
      Animated.spring(pressAnimation, {
        toValue: 1,
        tension: 150,
        friction: 4,
        useNativeDriver: true,
      }).start();
    }
  }, [pressAnimation, lock]);

  const handlePress = useCallback(() => {
    if (!lock) {
      // Enhanced haptic feedback with delightful animation sequence
      Animated.sequence([
        Animated.timing(pressAnimation, {
          toValue: 0.92,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(pressAnimation, {
          toValue: 1.02,
          tension: 200,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.spring(pressAnimation, {
          toValue: 1,
          tension: 150,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => onSelect(asset), 120);
    }
  }, [asset, lock, onSelect, pressAnimation]);

  const translateY = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const opacity = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const hasBalance = balance > 0;

  return (
    <Animated.View
      style={{
        transform: [{ translateY }, { scale: pressAnimation }],
        opacity,
      }}
    >
      <Animated.View>
        <Pressable
          disabled={lock}
          className={`flex w-full flex-row items-center justify-between rounded-2xl bg-accent/50 px-5 py-4 backdrop-blur-sm web:hover:bg-accent/30 ${
            lock ? 'opacity-50' : ''
          }`}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={typeof style === 'object' ? { ...style, height: 82 } : { height: 82 }}
          accessibilityLabel={`${asset.symbol} on ${CHAIN_NAMES[asset.chainId] ?? 'unknown network'} with balance ${balanceString}`}
          accessibilityHint={lock ? 'This token cannot be selected' : 'Tap to select this token'}
          accessibilityRole="button"
          accessibilityState={{ disabled: lock }}
        >
          <View className="flex flex-1 flex-row items-center gap-4">
            <View className="relative">
              <SwapAssetLogo asset={asset} size={44} />
              {hasBalance && (
                <View className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
              )}
            </View>
            <View className="flex-1">
              <View className="flex flex-row flex-wrap items-center gap-2">
                <Text
                  className={`text-base font-bold tracking-wide ${
                    isPopular ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {asset.symbol}
                </Text>
                {asset.isNative && (
                  <View className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5">
                    <Text className="text-xs font-medium text-primary">Native</Text>
                  </View>
                )}
              </View>
              <Text
                numberOfLines={1}
                className={`text-sm leading-tight opacity-80 ${
                  isPopular ? 'font-medium text-muted-foreground' : 'text-muted-foreground'
                }`}
              >
                {CHAIN_NAMES[asset.chainId] ?? asset.name}
              </Text>
            </View>
          </View>
          <View>
            {account && (
              <View className="items-end">
                <Text
                  className={`font-semibold transition-colors duration-200 ${
                    hasBalance
                      ? isPopular
                        ? 'font-bold text-primary'
                        : 'text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {balanceString}
                </Text>
                {balanceUsdString !== '0.00' && (
                  <Text
                    className={`text-sm opacity-75 transition-colors duration-200 ${
                      isPopular ? 'font-medium text-muted-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    ${balanceUsdString}
                  </Text>
                )}
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

/** "All" plus one pill per swap network. */
const ChainFilter = ({
  selected,
  onChange,
}: {
  selected: number | null;
  onChange: (chainId: number | null) => void;
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
    {[null, ...SWAP_CHAIN_IDS].map(chainId => {
      const isSelected = selected === chainId;
      const icon = chainId ? CHAIN_ICONS[chainId] : undefined;
      return (
        <Pressable
          key={chainId ?? 'all'}
          onPress={() => onChange(chainId)}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
            isSelected ? 'border-primary/60 bg-primary/15' : 'border-accent/40 bg-accent/50'
          }`}
        >
          {icon && (
            <Image
              source={icon}
              style={{ width: 16, height: 16, borderRadius: 8 }}
              contentFit="contain"
            />
          )}
          <Text
            className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {chainId ? CHAIN_NAMES[chainId] : 'All networks'}
          </Text>
        </Pressable>
      );
    })}
  </ScrollView>
);

const EmptyState = ({ message, isSearching }: { message: string; isSearching?: boolean }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <Animated.View
      style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}
      className="flex h-[534px] items-center justify-center px-8"
    >
      <View
        className={`rounded-3xl border p-8 backdrop-blur-sm transition-all duration-300 ${
          isSearching ? 'border-orange-200/30 bg-orange-50/50' : 'border-muted/20 bg-card/60'
        }`}
      >
        <Text
          className={`mb-3 text-center text-lg font-semibold tracking-wide transition-colors duration-200 ${
            isSearching ? 'text-orange-600' : 'text-muted-foreground'
          }`}
        >
          {message}
        </Text>
        {isSearching ? (
          <View>
            <Text className="mb-2 text-center text-sm font-medium text-orange-500/80">
              No tokens match your search
            </Text>
            <Text className="text-center text-xs text-muted-foreground/60">
              Try searching for a different token name, symbol, or paste a token address
            </Text>
          </View>
        ) : (
          <Text className="text-center text-sm text-muted-foreground/60">
            No tokens found in your wallet
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const LoadingState = () => {
  const [pulseAnim] = useState(new Animated.Value(1));
  const [rotateAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );

    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    );

    pulse.start();
    rotate.start();

    return () => {
      pulse.stop();
      rotate.stop();
    };
  }, [pulseAnim, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{ transform: [{ scale: pulseAnim }] }}
      className="flex h-[534px] items-center justify-center"
    >
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <ActivityIndicator size="large" color="#cccccc" />
      </Animated.View>
      <Text className="mt-4 text-base font-medium text-muted-foreground">Loading tokens...</Text>
      <Text className="mt-2 text-sm text-muted-foreground/60">Fetching balances and prices</Text>
    </Animated.View>
  );
};

const SwapTokenSelector = ({
  onSelect,
  otherAsset,
  showNativeToken = true,
}: {
  onSelect: (asset: SwapAsset) => void;
  otherAsset: SwapAsset | undefined;
  showNativeToken?: boolean;
}) => {
  const { assets, isLoading } = useSwapAssets();
  const [chainFilter, setChainFilter] = useState<number | null>(null);
  const [selectorView, setSelectorView] = useState<TokenSelectorViewType>(
    TokenSelectorView.DEFAULT_LIST,
  );

  // Held tokens first, largest first; the rest keep the catalogue's order.
  const tokens = useMemo(() => {
    const visible = assets.filter(
      asset =>
        (showNativeToken || !asset.isNative) &&
        (chainFilter === null || asset.chainId === chainFilter),
    );
    const held = visible
      .filter(asset => asset.balance > 0)
      .sort((a, b) => b.balanceUsd - a.balanceUsd || b.balance - a.balance);
    const rest = visible.filter(asset => !(asset.balance > 0));
    return [...held, ...rest];
  }, [assets, chainFilter, showNativeToken]);

  const [matchedTokens, setMatchedTokens] = useState<SwapAssetWithBalance[]>([]);
  const [currentQuery, setCurrentQuery] = useState<string | undefined>();

  const filteredTokens = useMemo(
    () => (currentQuery && matchedTokens.length ? matchedTokens : tokens),
    [tokens, matchedTokens, currentQuery],
  );

  const handleSearch = useCallback(
    (matchedTokens: SwapAssetWithBalance[]) => {
      if (matchedTokens.length) {
        setMatchedTokens(matchedTokens);
        setSelectorView(TokenSelectorView.DEFAULT_LIST);
      } else if (!isLoading) {
        setSelectorView(TokenSelectorView.NOT_FOUND);
      }
    },
    [isLoading],
  );

  const otherKey = otherAsset ? swapAssetKey(otherAsset) : undefined;

  const renderTokenRow = useCallback(
    ({ item, index }: { item: SwapAssetWithBalance; index: number }) => (
      <View key={swapAssetKey(item)} className="mb-2">
        <TokenRow
          asset={item}
          onSelect={onSelect}
          locked={swapAssetKey(item) === otherKey}
          style={{}}
          index={index}
        />
      </View>
    ),
    [onSelect, otherKey],
  );

  const keyExtractor = useCallback((item: SwapAssetWithBalance) => swapAssetKey(item), []);

  return (
    <View className="flex flex-col gap-4 pt-2">
      <Search
        data={tokens}
        onSearch={handleSearch}
        isLoading={false}
        onQueryChange={setCurrentQuery}
      />
      <ChainFilter selected={chainFilter} onChange={setChainFilter} />
      {selectorView === TokenSelectorView.DEFAULT_LIST ? (
        isLoading && tokens.length === 0 ? (
          <LoadingState />
        ) : filteredTokens.length === 0 ? (
          <EmptyState
            message={currentQuery ? 'No matching tokens found' : 'No tokens available'}
            isSearching={!!currentQuery}
          />
        ) : (
          <FlatList
            data={filteredTokens}
            keyExtractor={keyExtractor}
            renderItem={renderTokenRow}
            className="h-[534px]"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={12}
            windowSize={8}
            initialNumToRender={10}
            getItemLayout={(data, index) => ({
              length: 90,
              offset: 90 * index,
              index,
            })}
            contentContainerStyle={{
              paddingBottom: 250,
              paddingHorizontal: 2,
            }}
          />
        )
      ) : (
        <EmptyState message="Token not found" isSearching />
      )}
    </View>
  );
};

export default SwapTokenSelector;
