import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';

import { useBuyCryptoNavigation } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import { CardFundChip } from '@/components/Card/CardFund/CardFundRow';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useOnramperAssets } from '@/hooks/useOnramper';
import useOnramperAvailability from '@/hooks/useOnramperAvailability';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { useOnramperStore } from '@/store/useOnramperStore';

const ICON_STYLE = { width: 32, height: 32, borderRadius: 16 };

/**
 * Picks what to buy — one row per asset *and* network, because that pair is what
 * Onramper prices and what decides where the money lands. USDC on Base and USDC
 * on Ethereum are different destinations with different fees, so collapsing them
 * into one "USDC" row would hide the only choice being made here.
 *
 * The list is whatever our backend says is deliverable for the selected
 * currency, so it is never empty-by-accident: an empty list means Onramper sells
 * nothing we can credit, which is worth saying out loud.
 */
export const OnramperAssetSelector = () => {
  const setModal = useBuyCryptoNavigation();
  const { countryCode } = useOnramperAvailability();

  const fiatCurrency = useOnramperStore(state => state.fiatCurrency);
  const assetId = useOnramperStore(state => state.assetId);
  const setAssetId = useOnramperStore(state => state.setAssetId);

  const { data, isLoading } = useOnramperAssets(fiatCurrency ?? undefined, countryCode);
  const assets = data?.assets ?? [];

  const handleSelect = (id: string) => {
    track(TRACKING_EVENTS.ONRAMPER_ASSET_SELECTED, {
      asset_id: id,
      previous_asset_id: assetId ?? undefined,
      currency: fiatCurrency ?? undefined,
    });
    setAssetId(id);
    setModal(DEPOSIT_MODAL.OPEN_ONRAMPER_AMOUNT);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center rounded-[15px] bg-[#1C1C1C] py-10">
        <ActivityIndicator size="large" color="#94F27F" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="overflow-hidden rounded-[15px] bg-[#1C1C1C]">
          {assets.map((asset, index) => {
            const isSelected = asset.id === assetId;

            return (
              <Pressable
                key={asset.id}
                accessibilityRole="button"
                accessibilityLabel={`Select ${asset.code} on ${asset.networkName}`}
                accessibilityState={{ selected: isSelected }}
                className={cn(
                  'flex-row items-center justify-between px-4 py-4 active:bg-white/10 web:hover:bg-white/[0.06]',
                  index < assets.length - 1 && 'border-b border-white/10',
                  isSelected && 'bg-white/[0.06]',
                )}
                onPress={() => handleSelect(asset.id)}
              >
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                  {asset.icon ? (
                    <Image source={{ uri: asset.icon }} style={ICON_STYLE} contentFit="contain" />
                  ) : (
                    <View className="h-8 w-8 rounded-full bg-white/10" />
                  )}
                  <View className="min-w-0 flex-1 gap-1.5">
                    <Text className="text-base font-semibold text-white">{asset.code}</Text>
                    <View className="flex-row">
                      <CardFundChip label={asset.networkName} />
                    </View>
                  </View>
                </View>
                {isSelected ? (
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-brand">
                    <Check size={15} color="#111111" strokeWidth={2.5} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          {assets.length === 0 ? (
            <View className="items-center gap-2 px-6 py-10">
              <Text className="text-center text-sm font-medium text-white/70">
                Nothing available to buy
              </Text>
              <Text className="text-center text-xs font-medium leading-[18px] text-white/50">
                No asset we can deliver to your wallet is on sale for this currency. Try another
                currency.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

export default OnramperAssetSelector;
