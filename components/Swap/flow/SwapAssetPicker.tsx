import React, { Fragment, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import SwapAssetLogo from '@/components/Swap/SwapAssetLogo';
import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { SWAP_MODAL } from '@/constants/modals';
import { isSwapPairOpen } from '@/constants/swapChains';
import { useSwapAssets } from '@/hooks/swap/useSwapAssets';
import { useSwapDestinations } from '@/hooks/swap/useSwapDestinations';
import { useSwapFlow } from '@/hooks/swap/useSwapFlow';
import {
  assetDisplayName,
  getAssetSections,
  payAssetSections,
  SwapAssetRow,
} from '@/lib/swapAssets';
import { SwapField } from '@/lib/types/swap-field';
import { cn } from '@/lib/utils';
import { formatSwapAmount, formatSwapUsd } from '@/lib/utils/swap/format';
import { useSwapActionHandlers, useSwapState } from '@/store/swapStore';

const chainName = (chainId: number) => CHAIN_NAMES[chainId] ?? `chain ${chainId}`;

const AssetRow = ({
  row,
  showBalance,
  onPress,
}: {
  row: SwapAssetRow;
  showBalance: boolean;
  onPress: (row: SwapAssetRow) => void;
}) => (
  <Pressable
    onPress={() => onPress(row)}
    disabled={row.disabled}
    accessibilityRole="button"
    accessibilityState={{ disabled: row.disabled }}
    accessibilityLabel={`${row.name}, ${row.subtitle}`}
    className={cn(
      'flex-row items-center gap-[13px] px-[18px] py-[14px] web:hover:bg-card-hover',
      row.disabled && 'opacity-50',
    )}
  >
    <SwapAssetLogo asset={row.asset} size={36} showChain={row.members.length === 1} />
    <View className="flex-1 gap-0.5">
      <Text className="text-base font-semibold leading-5 text-white">{row.name}</Text>
      <Text numberOfLines={1} className="text-sm leading-[18px] text-white/60">
        {row.subtitle}
      </Text>
    </View>
    {showBalance && row.balance > 0 ? (
      <View className="items-end gap-0.5">
        <Text className="text-base font-semibold leading-5 text-white">
          {formatSwapUsd(row.balanceUsd)}
        </Text>
        <Text className="text-sm leading-[18px] text-white/60">
          {formatSwapAmount(row.balance)} {row.asset.symbol}
        </Text>
      </View>
    ) : null}
  </Pressable>
);

/**
 * Screens 2 and 3 of the swap: the coins, one row per asset rather than per
 * contract. "You pay" lists what's held; "You get" what the paying coin can
 * become, from the backend's route map.
 */
const SwapAssetPicker = ({ side }: { side: 'pay' | 'get' }) => {
  const { fromAsset } = useSwapFlow();
  const { assets, isLoading } = useSwapAssets();
  const reachable = useSwapDestinations(side === 'get' ? fromAsset : undefined);
  const { onAssetSelection } = useSwapActionHandlers();
  const { setModal, selectCurrency } = useSwapState(
    useShallow(state => ({
      setModal: state.actions.setModal,
      selectCurrency: state.actions.selectCurrency,
    })),
  );
  const [query, setQuery] = useState('');

  const sections = useMemo(
    () =>
      side === 'pay'
        ? payAssetSections(assets, { query, chainName })
        : getAssetSections(assets, { from: fromAsset, reachable, query, chainName }),
    [side, assets, query, fromAsset, reachable],
  );

  const handleSelect = useCallback(
    (row: SwapAssetRow) => {
      onAssetSelection(side === 'pay' ? SwapField.INPUT : SwapField.OUTPUT, row.asset);
      // A "You get" the new "You pay" can't reach is cleared for the user to
      // pick again, rather than left to quote "No route". Read back from the
      // store, since picking the coin "You get" holds swaps the two.
      const { [SwapField.INPUT]: pay, [SwapField.OUTPUT]: get } = useSwapState.getState();
      if (side === 'pay' && get.currencyId && !isSwapPairOpen(pay.chainId, get.chainId)) {
        selectCurrency(SwapField.OUTPUT, undefined, pay.chainId);
      }
      setModal(SWAP_MODAL.OPEN_FORM);
    },
    [onAssetSelection, side, selectCurrency, setModal],
  );

  return (
    <View className="gap-4">
      <View className="h-12 flex-row items-center gap-2 rounded-[15px] bg-card px-4">
        <Search size={18} color="rgba(255,255,255,0.5)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor="rgba(255,255,255,0.5)"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search coins"
          className="flex-1 text-base text-white web:focus:outline-none"
        />
      </View>

      {side === 'get' && fromAsset ? (
        <Text className="px-1 text-sm text-white/60">
          Showing what you can get for {assetDisplayName(fromAsset)}
        </Text>
      ) : null}

      {isLoading && sections.length === 0 ? (
        <View className="items-center py-10">
          <ActivityIndicator color="white" />
        </View>
      ) : sections.length === 0 ? (
        <Text className="py-10 text-center text-base text-white/60">
          {query
            ? 'No coins match that search'
            : side === 'pay'
              ? 'You don’t hold anything to swap yet'
              : 'Nothing to swap this into yet'}
        </Text>
      ) : (
        sections.map(section => (
          <View key={section.key} className="gap-2">
            <Text className="px-1 text-sm text-white/60">{section.title}</Text>
            <View className="overflow-hidden rounded-[15px] bg-card">
              {section.rows.map((row, index) => (
                <Fragment key={row.key}>
                  {index > 0 ? <View className="h-px bg-white/10" /> : null}
                  <AssetRow row={row} showBalance={side === 'pay'} onPress={handleSelect} />
                </Fragment>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
};

export default SwapAssetPicker;
