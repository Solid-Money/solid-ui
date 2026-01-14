import { useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { TokenBalance } from '@/lib/types';

import { DESKTOP_COLUMNS } from './columns';
import TokenRow from './TokenRow';
import { TokenListProps } from './types';

const TokenListDesktop = ({ tokens }: TokenListProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleTokenPress = useCallback(
    (token: TokenBalance) => {
      router.push(`/coins/${token.chainId}-${token.contractAddress}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: TokenBalance; index: number }) => (
      <TokenRow
        token={item}
        index={index}
        totalCount={tokens.length}
        onPress={() => handleTokenPress(item)}
      />
    ),
    [handleTokenPress, tokens.length],
  );

  const keyExtractor = useCallback(
    (item: TokenBalance) => `${item.chainId}-${item.contractAddress}`,
    [],
  );

  return (
    <View className="flex-1" style={{ minHeight: 200 }}>
      {/* Table Header - Static, not virtualized */}
      <View className="flex-row py-2">
        <View className="px-6 py-2" style={{ width: DESKTOP_COLUMNS[0].width }}>
          <Text className="text-sm text-muted-foreground">{DESKTOP_COLUMNS[0].label}</Text>
        </View>
        <View className="px-6 py-2" style={{ width: DESKTOP_COLUMNS[1].width }}>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm text-muted-foreground">{DESKTOP_COLUMNS[1].label}</Text>
            <TooltipPopover text="Balance without yield" />
          </View>
        </View>
        <View className="px-6 py-2" style={{ width: DESKTOP_COLUMNS[2].width }}>
          <Text className="text-sm text-muted-foreground">{DESKTOP_COLUMNS[2].label}</Text>
        </View>
        <View className="px-6 py-2" style={{ width: DESKTOP_COLUMNS[3].width }} />
      </View>

      {/* Table Body - Virtualized with FlashList */}
      <FlashList
        data={tokens}
        contentContainerStyle={{
          paddingBottom: insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
      />
    </View>
  );
};

export default TokenListDesktop;
