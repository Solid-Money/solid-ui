import React, { Fragment, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, ChevronUp, Search } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import AssetRow from '@/components/Assets/AssetRow';
import SwapAssetLogo from '@/components/Swap/SwapAssetLogo';
import { Text } from '@/components/ui/text';
import { CHAIN_ICONS, CHAIN_NAMES } from '@/constants/chains';
import { SWAP_MODAL } from '@/constants/modals';
import { isSwapPairOpen, swapAssetKey } from '@/constants/swapChains';
import { useSwapAssets } from '@/hooks/swap/useSwapAssets';
import { useMaxAPY } from '@/hooks/useAnalytics';
import {
  getAssetRows,
  matchesSwapAsset,
  payAssetRows,
  SwapAssetCategory,
  SwapAssetRow,
} from '@/lib/swapAssets';
import { VaultType } from '@/lib/types';
import { SwapAsset } from '@/lib/types/lifi-swap';
import { SwapField } from '@/lib/types/swap-field';
import { cn } from '@/lib/utils';
import { formatSwapTokenAmount, formatSwapUsd } from '@/lib/utils/swap/format';
import { useSwapActionHandlers, useSwapState } from '@/store/swapStore';

type CategoryFilter = 'all' | SwapAssetCategory;

const FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'stablecoins', label: 'Stablecoins' },
  { key: 'earn', label: 'Earn' },
  { key: 'crypto', label: 'Crypto' },
];

const chainName = (chainId: number) => CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;

const PickerRow = ({
  row,
  isPay,
  expanded,
  apy,
  onPress,
  onSelect,
}: {
  row: SwapAssetRow;
  isPay: boolean;
  expanded: boolean;
  apy?: number;
  onPress: () => void;
  onSelect: (asset: SwapAsset) => void;
}) => {
  const hasNetworks = row.members.length > 1;
  const decimals = row.category === 'stablecoins' ? 2 : 0;
  const ticker = isPay
    ? `${formatSwapTokenAmount(row.balance, decimals)} ${row.symbol}`
    : row.symbol;
  const subtitle = hasNetworks ? `${ticker} · ${row.members.length} networks` : ticker;
  const value = isPay && row.balanceUsd > 0 ? formatSwapUsd(row.balanceUsd) : undefined;
  const Chevron = expanded ? ChevronUp : ChevronDown;
  const label = [
    row.name,
    subtitle,
    !hasNetworks && chainName(row.asset.chainId),
    value,
    apy !== undefined && `${apy.toFixed(1)}% APY`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View>
      <AssetRow
        title={row.name}
        subtitle={subtitle}
        isEarning={apy !== undefined}
        apy={apy}
        value={undefined}
        accessibilityLabel={label}
        accessibilityState={hasNetworks ? { expanded } : undefined}
        onPress={onPress}
        icon={
          <SwapAssetLogo
            asset={row.asset}
            pickerKey={row.key}
            size={40}
            showChain={!hasNetworks && row.category !== 'earn'}
          />
        }
        trailing={
          (value !== undefined || hasNetworks) && (
            <View className="shrink-0 flex-row items-center gap-3">
              {value && (
                <Text className="text-[16px] font-semibold leading-5 text-white">{value}</Text>
              )}
              {hasNetworks && <Chevron size={18} color="rgba(255,255,255,0.5)" />}
            </View>
          )
        }
      />
      {expanded && (
        <View className="flex-row flex-wrap gap-2 px-4 pb-[14px] pt-0.5">
          {row.members.map(member => {
            const name = chainName(member.chainId);
            const icon = CHAIN_ICONS[member.chainId];
            const balance = isPay
              ? member.balanceUsd > 0
                ? formatSwapUsd(member.balanceUsd)
                : `${formatSwapTokenAmount({ raw: member.balanceRaw, decimals: member.decimals }, decimals)} ${row.symbol}`
              : undefined;
            return (
              <Pressable
                key={swapAssetKey(member)}
                onPress={() => onSelect(member)}
                accessibilityRole="button"
                accessibilityLabel={`${row.name} on ${name}${balance ? `, ${balance}` : ''}`}
                className="min-h-9 flex-row items-center gap-2 rounded-[10px] bg-[#2A2A2A] py-2 pl-2.5 pr-3 active:bg-white/15 web:hover:bg-white/15"
              >
                {icon ? (
                  <Image source={icon} style={{ width: 20, height: 20 }} contentFit="contain" />
                ) : null}
                <Text className="text-[14px] font-medium leading-5 text-white">{name}</Text>
                {balance && <Text className="text-[14px] leading-5 text-white/50">{balance}</Text>}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
};

type SwapAssetPickerProps =
  | { side: 'pay' }
  | {
      side: 'get';
      fromAsset: SwapAsset | undefined;
      reachable: ReadonlySet<string> | null | undefined;
    };

const SwapAssetPicker = (props: SwapAssetPickerProps) => {
  const isPay = props.side === 'pay';
  const { fromAsset, reachable } = props.side === 'get' ? props : {};
  const { assets, isLoading } = useSwapAssets();
  const isListLoading = isLoading || (!isPay && reachable === undefined);
  const usdRate = useMaxAPY(VaultType.USDC);
  const fuseRate = useMaxAPY(VaultType.FUSE);
  const rates = new Map([
    ['USD Yield', usdRate],
    ['FUSE Yield', fuseRate],
  ]);
  const { onAssetSelection } = useSwapActionHandlers();
  const { setModal, selectCurrency } = useSwapState(
    useShallow(state => ({
      setModal: state.actions.setModal,
      selectCurrency: state.actions.selectCurrency,
    })),
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const allRows = useMemo(() => {
    if (isListLoading) return [];
    return isPay
      ? payAssetRows(assets)
      : getAssetRows(assets, { from: fromAsset, reachable: reachable ?? null });
  }, [assets, fromAsset, isListLoading, isPay, reachable]);
  const rows = allRows.filter(
    row => (category === 'all' || row.category === category) && matchesSwapAsset(row, query),
  );

  const selectAsset = useCallback(
    (asset: SwapAsset) => {
      onAssetSelection(isPay ? SwapField.INPUT : SwapField.OUTPUT, asset);
      // Read the settled pair because picking the output asset as input can flip the fields.
      const { [SwapField.INPUT]: pay, [SwapField.OUTPUT]: get } = useSwapState.getState();
      if (isPay && pay.currencyId && get.currencyId && !isSwapPairOpen(pay.chainId, get.chainId)) {
        selectCurrency(SwapField.OUTPUT, undefined, pay.chainId);
      }
      setModal(SWAP_MODAL.OPEN_FORM);
    },
    [isPay, onAssetSelection, selectCurrency, setModal],
  );

  const handleSearch = (value: string) => {
    if (!query.trim() && value.trim()) setCategory('all');
    setQuery(value);
    setExpandedKey(null);
  };

  return (
    <View className="gap-3">
      <View className="h-[45px] flex-row items-center gap-2.5 rounded-xl bg-card px-3.5">
        <Search size={18} color="rgba(255,255,255,0.5)" />
        <TextInput
          value={query}
          onChangeText={handleSearch}
          placeholder="Search"
          placeholderTextColor="rgba(255,255,255,0.45)"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search coins"
          className="min-w-0 flex-1 p-0 text-[15px] text-white web:focus:outline-none"
        />
      </View>

      {!isPay && (
        <View className="flex-row flex-wrap items-center gap-2">
          {FILTERS.map(({ key, label }) => {
            const selected = category === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setCategory(key);
                  setExpandedKey(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                className={cn(
                  'rounded-full px-3.5 py-1.5',
                  selected ? 'bg-white' : 'border border-[#303030] active:bg-white/5',
                )}
              >
                <Text
                  className={cn(
                    'text-[14px] leading-5',
                    selected ? 'font-semibold text-[#111]' : 'font-medium text-white/70',
                  )}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {isListLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator accessibilityLabel="Loading coins" color="white" />
        </View>
      ) : rows.length === 0 ? (
        <Text className="py-10 text-center text-[16px] text-white/60">
          {query.trim()
            ? `No coins match “${query.trim()}”`
            : isPay
              ? 'You don’t hold anything to swap yet'
              : category === 'all'
                ? 'Nothing to swap this into yet'
                : 'No coins in this category'}
        </Text>
      ) : (
        <View className="overflow-hidden rounded-[20px] bg-card">
          {rows.map((row, index) => {
            const canExpand = row.members.length > 1;
            const rate = rates.get(row.key);
            return (
              <Fragment key={row.key}>
                {index > 0 && <View className="h-px bg-[#2A2A2A]" />}
                <PickerRow
                  row={row}
                  isPay={isPay}
                  expanded={canExpand && expandedKey === row.key}
                  apy={
                    rate && !rate.isAPYsLoading && Number.isFinite(rate.maxAPY) && rate.maxAPY > 0
                      ? rate.maxAPY
                      : undefined
                  }
                  onPress={() => {
                    if (canExpand) setExpandedKey(open => (open === row.key ? null : row.key));
                    else selectAsset(row.asset);
                  }}
                  onSelect={selectAsset}
                />
              </Fragment>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default SwapAssetPicker;
