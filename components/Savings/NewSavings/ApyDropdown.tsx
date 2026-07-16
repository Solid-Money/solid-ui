import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';
import { VaultType } from '@/lib/types';
import { cn } from '@/lib/utils';

import {
  type ApyByType,
  formatApyLabel,
  getVaultDisplay,
  SAVINGS_VAULTS,
} from './savingsVaultData';
import SelectSheet from './SelectSheet';

type ApyPillProps = {
  vaultType: VaultType;
  apyByType: ApyByType;
} & React.ComponentProps<typeof Pressable>;

/** The APY dropdown pill: selected vault icon + "X% APY" + chevron. */
export const ApyPill = React.forwardRef<View, ApyPillProps>(
  ({ vaultType, apyByType, ...props }, ref) => {
    const vault = getVaultDisplay(vaultType);
    const { maxAPY, isAPYsLoading } = apyByType[vaultType];
    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel="Show vault APYs"
        className="flex-row items-center gap-2 self-center rounded-full bg-[#1C1C1C] py-2 pl-2 pr-3 transition-all active:scale-95 active:opacity-80"
        {...props}
      >
        <Image
          source={getAsset(vault.icon)}
          style={{ width: 20, height: 20, borderRadius: 10 }}
          contentFit="contain"
        />
        <Text className="text-base font-semibold text-brand">
          {formatApyLabel(maxAPY, isAPYsLoading)} APY
        </Text>
        <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
      </Pressable>
    );
  },
);
ApyPill.displayName = 'ApyPill';

const VaultApyRow = ({
  vaultType,
  apyByType,
  selected,
  onPress,
}: {
  vaultType: VaultType;
  apyByType: ApyByType;
  selected: boolean;
  onPress: () => void;
}) => {
  const vault = getVaultDisplay(vaultType);
  const { maxAPY, isAPYsLoading } = apyByType[vaultType];
  return (
    <Pressable
      onPress={onPress}
      style={{ opacity: selected ? 1 : 0.5 }}
      className="flex-row items-center justify-between px-5 py-3 web:hover:bg-card-hover"
    >
      <View className="flex-row items-center gap-3">
        <Image
          source={getAsset(vault.icon)}
          style={{ width: 32, height: 32, borderRadius: 16 }}
          contentFit="contain"
        />
        <Text className="text-base font-semibold text-white">{vault.name}</Text>
      </View>
      <Text className="text-base font-semibold text-white">
        {formatApyLabel(maxAPY, isAPYsLoading)} APY
      </Text>
    </Pressable>
  );
};

interface ApyDropdownProps {
  vaultType: VaultType;
  apyByType: ApyByType;
  onSelect: (vaultType: VaultType) => void;
  className?: string;
}

/**
 * "X% APY" pill that opens a bottom sheet (native) / dialog (web) listing every
 * vault's APY. Defaults to (and highlights) the currently selected vault — USDC
 * by default on the redesigned savings screen.
 */
const ApyDropdown = ({ vaultType, apyByType, onSelect, className }: ApyDropdownProps) => {
  return (
    <View className={cn('items-center', className)}>
      <SelectSheet
        trigger={<ApyPill vaultType={vaultType} apyByType={apyByType} />}
        title="Vault APY"
      >
        {dismiss =>
          SAVINGS_VAULTS.map(vault => (
            <VaultApyRow
              key={vault.type}
              vaultType={vault.type}
              apyByType={apyByType}
              selected={vault.type === vaultType}
              onPress={() => {
                onSelect(vault.type);
                dismiss();
              }}
            />
          ))
        }
      </SelectSheet>
    </View>
  );
};

export default ApyDropdown;
