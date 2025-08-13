import { Text } from '@/components/ui/text';
import { ADDRESS_ZERO, Currency, ExtendedNative, Token } from '@cryptoalgebra/fuse-sdk';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleProp,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Address, erc20Abi, isAddress } from 'viem';
import { useBalance } from 'wagmi';

import { useAllTokens } from '@/hooks/tokens/useAllTokens';
import { useCurrency } from '@/hooks/tokens/useCurrency';
import useDebounce from '@/hooks/useDebounce';
import { useFuse } from '@/hooks/useFuse';
import { useUSDCPrice } from '@/hooks/useUSDCValue';
import { TokenListItem } from '@/lib/types/tokens';
import { formatNumber } from '@/lib/utils';
import { multicall3 } from '@/lib/utils/multicall';

import CopyToClipboard from '@/components/CopyToClipboard';
import CurrencyLogo from '@/components/CurrencyLogo';
import { useAlgebraToken } from '@/hooks/tokens/useAlgebraToken';
import useUser from '@/hooks/useUser';
import { useTokensState } from '@/store/tokensStore';
import { fuse } from 'viem/chains';

const TokenSelectorView = {
  DEFAULT_LIST: 'DEFAULT_LIST',
  IMPORT_TOKEN: 'IMPORT_TOKEN',
  NOT_FOUND: 'NOT_FOUND',
} as const;

type TokenSelectorViewType = (typeof TokenSelectorView)[keyof typeof TokenSelectorView];

const Search = ({
  data,
  onSearch,
  isLoading,
  onQueryChange,
}: {
  data: (TokenListItem & { balance: number })[];
  onSearch: (
    matchedTokens: (TokenListItem & { balance: number })[],
    importToken: Token | undefined,
  ) => void;
  isLoading: boolean;
  onQueryChange?: (query: string | undefined) => void;
}) => {
  const [query, setQuery] = useState<Address | string | undefined>(undefined);
  const [isFocused, setIsFocused] = useState(false);
  const [searchAnimation] = useState(new Animated.Value(0));
  const [pulseAnimation] = useState(new Animated.Value(1));

  const debouncedQuery = useDebounce(query, 200);
  const tokenEntity = useAlgebraToken(
    debouncedQuery && isAddress(debouncedQuery) ? debouncedQuery : undefined,
  );

  const fuseOptions = useMemo(
    () => ({
      keys: ['id', 'symbol', 'name'],
      threshold: 0,
    }),
    [],
  );

  const { result, pattern, search } = useFuse<TokenListItem & { balance: number }>({
    data,
    options: fuseOptions,
  });

  const handleInput = useCallback(
    (input: string | undefined) => {
      setQuery(input);
      onQueryChange?.(input);

      // Animate search activity
      if (input && input.length > 0) {
        Animated.timing(searchAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }).start();
      } else {
        Animated.timing(searchAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
    },
    [searchAnimation, onQueryChange],
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    Animated.timing(searchAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [searchAnimation]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (!query) {
      Animated.timing(searchAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [searchAnimation, query]);

  useEffect(() => {
    search(query);
  }, [query, search]);

  useEffect(() => {
    onSearch(result, tokenEntity instanceof ExtendedNative ? undefined : tokenEntity);
  }, [result, tokenEntity, pattern, onSearch]);

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

  const borderColor = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(156, 163, 175, 0.3)', 'rgba(59, 130, 246, 0.8)'],
  });

  const shadowOpacity = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.15],
  });

  return (
    <View className="relative">
      <Animated.View
        style={{
          borderWidth: isFocused ? 2.5 : 2,
          borderColor,
          borderRadius: 16,
          shadowOffset: { width: 0, height: isFocused ? 6 : 4 },
          shadowOpacity,
          shadowRadius: isFocused ? 12 : 8,
          elevation: isFocused ? 8 : 4,
        }}
        className="bg-card"
      >
        <TextInput
          placeholder={
            isFocused ? "Try 'USDC', 'VOLT' or paste token address..." : 'Search tokens...'
          }
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
      </Animated.View>
      {isLoading && (
        <Animated.View
          style={{
            opacity: pulseAnimation,
            transform: [{ scale: pulseAnimation }],
          }}
          className="absolute right-3 top-3 bg-primary/10 rounded-full p-2"
        >
          <ActivityIndicator size="small" color="rgba(59, 130, 246, 0.9)" />
        </Animated.View>
      )}
      {query && query.length > 0 && !isLoading && (
        <Animated.View
          className="absolute right-3 top-3"
          style={{
            transform: [{ scale: searchAnimation }],
          }}
        >
          <View
            className={`rounded-full p-1 border transition-all duration-200 ${
              result.length > 0
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-orange-500/10 border-orange-500/20'
            }`}
          >
            <Text
              className={`text-xs font-semibold px-2 transition-colors duration-200 ${
                result.length > 0 ? 'text-green-600' : 'text-orange-600'
              }`}
            >
              {result.length === 0 ? 'No matches' : `${result.length} found`}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const TokenRow = ({
  balance,
  token,
  onSelect,
  otherCurrency,
  style,
  index = 0,
}: {
  token: TokenListItem;
  balance: number;
  onSelect: (currency: Currency) => void;
  otherCurrency: Currency | null | undefined;
  style: StyleProp<ViewStyle>;
  index?: number;
}) => {
  const { user } = useUser();
  const account = user?.safeAddress;
  const currency = useCurrency(token.address as Address);
  const [pressAnimation] = useState(new Animated.Value(1));
  const [slideAnimation] = useState(new Animated.Value(0));
  const [hoverAnimation] = useState(new Animated.Value(0));

  const { formatted } = useUSDCPrice(currency);

  const balanceString = useMemo(() => {
    return formatNumber(balance || 0);
  }, [balance]);

  const balanceUsdString = useMemo(() => {
    return formatNumber((balance || 0) * formatted);
  }, [formatted, balance]);

  const lock = otherCurrency?.isNative
    ? token.address === ADDRESS_ZERO
    : token.address.toLowerCase() === otherCurrency?.wrapped.address.toLowerCase();

  const isPopular = useMemo(() => {
    return balance > 0;
  }, [balance]);

  // Staggered entrance animation
  useEffect(() => {
    const delay = index * 50; // 50ms delay between each item
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
      Animated.parallel([
        Animated.spring(pressAnimation, {
          toValue: 0.96,
          tension: 150,
          friction: 4,
          useNativeDriver: true,
        }),
        Animated.timing(hoverAnimation, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [pressAnimation, hoverAnimation, lock]);

  const handlePressOut = useCallback(() => {
    if (!lock) {
      Animated.parallel([
        Animated.spring(pressAnimation, {
          toValue: 1,
          tension: 150,
          friction: 4,
          useNativeDriver: true,
        }),
        Animated.timing(hoverAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [pressAnimation, hoverAnimation, lock]);

  const handlePress = useCallback(() => {
    if (currency && !lock) {
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

      setTimeout(() => onSelect(currency), 120);
    }
  }, [currency, lock, onSelect, pressAnimation]);

  const translateY = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const opacity = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const borderColor = hoverAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(156, 163, 175, 0.1)', 'rgba(59, 130, 246, 0.3)'],
  });

  const hasBalance = balance > 0;

  return (
    <Animated.View
      style={{
        transform: [{ translateY }, { scale: pressAnimation }],
        opacity,
      }}
    >
      <Animated.View style={{ borderColor, borderWidth: isPopular ? 1.5 : 1, borderRadius: 16 }}>
        <Pressable
          disabled={lock}
          className={`flex flex-row items-center justify-between w-full py-4 px-5 bg-card/95 backdrop-blur-sm rounded-2xl ${
            lock ? 'opacity-50' : ''
          } ${isPopular ? 'bg-card/98' : 'bg-card/95'}`}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={typeof style === 'object' ? { ...style, height: 82 } : { height: 82 }}
          accessibilityLabel={`${token.symbol} token with balance ${balanceString}`}
          accessibilityHint={lock ? 'This token cannot be selected' : 'Tap to select this token'}
          accessibilityRole="button"
          accessibilityState={{ disabled: lock }}
        >
          <View className="flex flex-row items-center gap-4 flex-1">
            <View className="relative">
              <CurrencyLogo currency={currency} size={44} />
              {hasBalance && (
                <View className="absolute -top-1 -right-1 bg-green-500 rounded-full w-3 h-3 border-2 border-card" />
              )}
            </View>
            <View className="flex-1">
              <View className="flex flex-row gap-2 items-center flex-wrap">
                <Text
                  className={`text-base font-bold tracking-wide ${
                    isPopular ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {token.symbol}
                </Text>
                {token.address === ADDRESS_ZERO && (
                  <View className="bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                    <Text className="text-xs text-primary font-medium">Native</Text>
                  </View>
                )}
                <CopyToClipboard text={token.address} />
              </View>
              <Text
                className={`text-sm mt-1 opacity-80 leading-tight ${
                  isPopular ? 'text-muted-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                {token.name}
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
                        ? 'text-primary font-bold'
                        : 'text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {balanceString}
                </Text>
                {balanceUsdString !== '0.00' && (
                  <Text
                    className={`text-sm opacity-75 transition-colors duration-200 ${
                      isPopular ? 'text-muted-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    ${balanceUsdString}
                  </Text>
                )}
                {!hasBalance && (
                  <Text className="text-xs text-muted-foreground/50 mt-1">No balance</Text>
                )}
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

const ImportTokenRow = ({
  token,
  onImport,
}: {
  token: Token;
  onImport: (token: Token) => void;
}) => {
  const handleImport = useCallback(() => {
    onImport(token);
  }, [onImport, token]);

  return (
    <View className="flex flex-row justify-between w-full p-4 bg-card rounded-2xl">
      <View className="flex flex-row items-center gap-4">
        <View>
          <CurrencyLogo currency={token} size={45} />
        </View>
        <View>
          <Text className="text-base font-bold">{token.symbol}</Text>
          <Text className="text-sm text-muted-foreground">{token.name}</Text>
        </View>
      </View>
      <Pressable
        className="px-4 py-2 bg-primary rounded-2xl"
        onPress={handleImport}
        accessibilityLabel="Import token"
        accessibilityHint="Tap to import this token to your list"
      >
        <Text className="text-primary-foreground font-bold">Import</Text>
      </Pressable>
    </View>
  );
};

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
      className="flex items-center justify-center h-[534px] px-8"
    >
      <View
        className={`rounded-3xl p-8 border backdrop-blur-sm transition-all duration-300 ${
          isSearching ? 'bg-orange-50/50 border-orange-200/30' : 'bg-card/60 border-muted/20'
        }`}
      >
        <Text
          className={`text-center text-lg font-semibold tracking-wide mb-3 transition-colors duration-200 ${
            isSearching ? 'text-orange-600' : 'text-muted-foreground'
          }`}
        >
          {message}
        </Text>
        {isSearching ? (
          <View>
            <Text className="text-orange-500/80 text-center text-sm mb-2 font-medium">
              No tokens match your search
            </Text>
            <Text className="text-muted-foreground/60 text-center text-xs">
              Try searching for a different token name, symbol, or paste a token address
            </Text>
          </View>
        ) : (
          <Text className="text-muted-foreground/60 text-center text-sm">
            Connect your wallet to see token balances and start trading
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
      className="flex items-center justify-center h-[534px]"
    >
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <ActivityIndicator size="large" color="rgba(59, 130, 246, 0.8)" />
      </Animated.View>
      <Text className="text-muted-foreground mt-4 text-base font-medium">Loading tokens...</Text>
      <Text className="text-muted-foreground/60 mt-2 text-sm">Fetching balances and prices</Text>
    </Animated.View>
  );
};

const SwapTokenSelector = ({
  onSelect,
  otherCurrency,
  showNativeToken = true,
}: {
  onSelect: (currency: Currency) => void;
  otherCurrency: Currency | null | undefined;
  showNativeToken?: boolean;
}) => {
  const { user } = useUser();
  const account = user?.safeAddress;
  const { data: nativeTokenBalance } = useBalance({ address: account, chainId: fuse.id });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<(TokenListItem & { balance: number })[]>([]);
  const [selectorView, setSelectorView] = useState<TokenSelectorViewType>(
    TokenSelectorView.DEFAULT_LIST,
  );

  const {
    actions: { importToken },
  } = useTokensState();

  const { tokens: allTokens, isLoading: allTokensLoading } = useAllTokens(showNativeToken);

  const [matchedTokens, setMatchedTokens] = useState<(TokenListItem & { balance: number })[]>([]);
  const [tokenForImport, setTokenForImport] = useState<Token>();
  const [currentQuery, setCurrentQuery] = useState<string | undefined>();

  const filteredTokens = useMemo(
    () => (matchedTokens.length ? matchedTokens : tokens),
    [tokens, matchedTokens],
  );

  const handleSearch = useCallback(
    (matchedTokens: (TokenListItem & { balance: number })[], importToken: Token | undefined) => {
      if (matchedTokens.length) {
        setMatchedTokens(matchedTokens);
        setSelectorView(TokenSelectorView.DEFAULT_LIST);
      } else if (importToken) {
        setTokenForImport(importToken);
        setSelectorView(TokenSelectorView.IMPORT_TOKEN);
      } else if (!isLoading) {
        setSelectorView(TokenSelectorView.NOT_FOUND);
      }
    },
    [isLoading],
  );

  const handleImport = useCallback(
    (token: Token) => {
      importToken(
        token.address as Address,
        token.symbol || 'Unknown',
        token.name || 'Unknown',
        token.decimals,
        token.chainId,
      );
      setSelectorView(TokenSelectorView.DEFAULT_LIST);
      setTokenForImport(undefined);
    },
    [importToken],
  );

  const renderTokenRow = useCallback(
    ({ item, index }: { item: TokenListItem & { balance: number }; index: number }) => (
      <View key={item.address} className="mb-2">
        <TokenRow
          balance={item.balance}
          onSelect={onSelect}
          token={item}
          otherCurrency={otherCurrency}
          style={{}}
          index={index}
        />
      </View>
    ),
    [onSelect, otherCurrency],
  );

  const keyExtractor = useCallback((item: TokenListItem & { balance: number }) => item.address, []);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!allTokens || !account) return;

      try {
        setError(null);
        const tokenAddresses = allTokens.map(token => token.address);
        const balancesAndDecimals = await multicall3(
          {
            contracts: tokenAddresses.flatMap(address => [
              {
                address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [account],
              },
              {
                address,
                abi: erc20Abi,
                functionName: 'decimals',
              },
            ]),
          },
          fuse.id,
        );

        const balances = balancesAndDecimals.filter((_, index) => index % 2 === 0);
        const decimals = balancesAndDecimals.filter((_, index) => index % 2 !== 0);

        const tokensWithBalances = allTokens.map((token, index) => {
          const isNativeToken = token.address === ADDRESS_ZERO;
          const balance = isNativeToken ? nativeTokenBalance?.value : balances[index]?.result;
          const decimal = isNativeToken ? nativeTokenBalance?.decimals : decimals[index]?.result;

          const formattedBalance = balance ? Number(balance) / 10 ** Number(decimal) : 0;

          return {
            ...token,
            balance: formattedBalance,
          };
        });

        const fuseToken = tokensWithBalances.find(token => token.address === ADDRESS_ZERO);
        const otherTokens = tokensWithBalances.filter(token => token.address !== ADDRESS_ZERO);

        const sortedTokens = [
          ...(fuseToken ? [fuseToken] : []),
          ...otherTokens.sort((a, b) => (b.balance || 0) - (a.balance || 0)),
        ] as (TokenListItem & { balance: number })[];

        setTokens(sortedTokens);
      } catch (err) {
        setError('Failed to load token balances');
        console.error('Error fetching balances:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (allTokens) {
      fetchBalances();
    }
  }, [allTokens, allTokensLoading, account, nativeTokenBalance]);

  if (error) {
    return <EmptyState message={error} />;
  }

  return (
    <View className="flex flex-col gap-6 pt-2">
      <Search
        data={tokens}
        onSearch={handleSearch}
        isLoading={false}
        onQueryChange={setCurrentQuery}
      />
      {selectorView === TokenSelectorView.DEFAULT_LIST ? (
        isLoading ? (
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
              length: 82,
              offset: 82 * index,
              index,
            })}
            contentContainerStyle={{
              paddingBottom: 20,
              paddingHorizontal: 2,
            }}
          />
        )
      ) : selectorView === TokenSelectorView.IMPORT_TOKEN && tokenForImport ? (
        <ImportTokenRow token={tokenForImport} onImport={handleImport} />
      ) : (
        <EmptyState message="Token not found" />
      )}
    </View>
  );
};

export default SwapTokenSelector;
