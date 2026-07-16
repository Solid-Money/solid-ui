import { Fragment } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';
import { VaultType } from '@/lib/types';

import { type ApyByType, formatApyLabel, SAVINGS_VAULTS } from './savingsVaultData';

interface MoreSavingsOptionsProps {
  selectedType: VaultType;
  apyByType: ApyByType;
  onSelect: (vaultType: VaultType) => void;
}

/**
 * "More savings options" — the vaults other than the currently selected one,
 * each showing its APY. Tapping a row switches the active vault (updating the
 * APY pill + simulation above).
 */
const MoreSavingsOptions = ({ selectedType, apyByType, onSelect }: MoreSavingsOptionsProps) => {
  const others = SAVINGS_VAULTS.filter(vault => vault.type !== selectedType);
  if (others.length === 0) return null;

  return (
    <View className="gap-3 px-4">
      <Text className="text-lg font-semibold text-muted-foreground">More savings options</Text>
      <View className="overflow-hidden rounded-twice bg-card">
        {others.map((vault, index) => {
          const { maxAPY, isAPYsLoading } = apyByType[vault.type];
          return (
            <Fragment key={vault.type}>
              {index > 0 && <View className="h-px bg-border/40" />}
              <Pressable
                onPress={() => onSelect(vault.type)}
                className="flex-row items-center justify-between px-5 py-4 web:hover:bg-card-hover"
              >
                <View className="flex-row items-center gap-3">
                  <Image
                    source={getAsset(vault.icon)}
                    style={{ width: 36, height: 36, borderRadius: 18 }}
                    contentFit="contain"
                  />
                  <Text className="text-base font-semibold text-white">{vault.name}</Text>
                </View>
                <Text className="text-base font-semibold text-brand">
                  {formatApyLabel(maxAPY, isAPYsLoading)} APY
                </Text>
              </Pressable>
            </Fragment>
          );
        })}
      </View>
    </View>
  );
};

export default MoreSavingsOptions;
