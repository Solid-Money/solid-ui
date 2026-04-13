import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Check, ChevronDown } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import { Text } from '@/components/ui/text';
import { VAULTS } from '@/constants/vaults';
import { useIsTestUser } from '@/hooks/useIsTestUser';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { getAsset } from '@/lib/assets';
import { Vault } from '@/lib/types';
import { getDefaultDepositSelection } from '@/lib/vaults';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

const getVaultIcon = (vault: Vault) =>
  vault.name === 'USDC' ? getAsset('images/sousd-4x.png') : getAsset(vault.icon);

const VaultSelectorDropdown = () => {
  const { vault: selectedVault } = useVaultDepositConfig();
  const { selectVaultForDeposit } = useSavingStore(
    useShallow(state => ({
      selectVaultForDeposit: state.selectVaultForDeposit,
    })),
  );
  const { setSrcChainId, setPrincipalToken } = useDepositStore(
    useShallow(state => ({
      setSrcChainId: state.setSrcChainId,
      setPrincipalToken: state.setPrincipalToken,
    })),
  );
  const isTestUser = useIsTestUser();

  const [isOpen, setIsOpen] = useState(false);

  const rotation = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const dropdownOpacity = useSharedValue(0);

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const dropdownHeight = useDerivedValue(() => {
    return isOpen ? contentHeight.value : 0;
  });

  const dropdownAnimatedStyle = useAnimatedStyle(() => ({
    height: withTiming(dropdownHeight.value, { duration: 200 }),
    opacity: dropdownOpacity.value,
  }));

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    rotation.value = withTiming(isOpen ? 0 : 180, { duration: 200 });
    dropdownOpacity.value = withTiming(isOpen ? 0 : 1, { duration: isOpen ? 150 : 200 });
  };

  const handleSelect = (index: number) => {
    const vault = VAULTS[index];
    const isComingSoon = !!vault?.isComingSoon && !isTestUser;
    if (isComingSoon || !vault) return;

    selectVaultForDeposit(index);

    // Reset chain + token to the first available token for the newly selected vault
    const { chainId, principalToken } = getDefaultDepositSelection(vault);
    if (chainId) setSrcChainId(chainId);
    setPrincipalToken(principalToken);

    setIsOpen(false);
    rotation.value = withTiming(0, { duration: 200 });
    dropdownOpacity.value = withTiming(0, { duration: 150 });
  };

  return (
    <View className="rounded-2xl bg-accent">
      <Pressable
        className="flex-row items-center justify-between gap-2 px-5 py-4 web:hover:opacity-70"
        onPress={toggleDropdown}
      >
        <View className="flex-row items-center gap-3">
          <Image
            source={getVaultIcon(selectedVault)}
            style={{ width: 28, height: 28 }}
            contentFit="contain"
          />
          <Text className="text-base">{selectedVault.vaultName}</Text>
        </View>
        <Animated.View style={animatedChevronStyle}>
          <ChevronDown color="white" size={20} />
        </Animated.View>
      </Pressable>
      <Animated.View style={dropdownAnimatedStyle} className="overflow-hidden">
        <View
          onLayout={event => {
            contentHeight.value = event.nativeEvent.layout.height;
          }}
        >
          {VAULTS.map((vault, index) => {
            const isSelected = vault.name === selectedVault.name;
            const isComingSoon = !!vault.isComingSoon && !isTestUser;
            return (
              <Pressable
                key={vault.name}
                onPress={() => handleSelect(index)}
                disabled={isComingSoon}
                className="flex-row items-center justify-between gap-3 border-t border-card px-5 py-4 web:hover:opacity-70"
                style={{ opacity: isComingSoon ? 0.5 : 1 }}
              >
                <View className="flex-row items-center gap-3">
                  <Image
                    source={getVaultIcon(vault)}
                    style={{ width: 24, height: 24 }}
                    contentFit="contain"
                  />
                  <Text className="text-base">{vault.vaultName}</Text>
                  {isComingSoon && (
                    <Text className="text-xs text-muted-foreground">(Coming soon)</Text>
                  )}
                </View>
                {isSelected && <Check color="white" size={18} />}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
};

export default VaultSelectorDropdown;
