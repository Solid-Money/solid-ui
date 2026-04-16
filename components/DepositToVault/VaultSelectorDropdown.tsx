import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
  const dropdownOpacity = useSharedValue(0);

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const dropdownAnimatedStyle = useAnimatedStyle(() => ({
    opacity: dropdownOpacity.value,
    transform: [{ translateY: withTiming(isOpen ? 0 : -8, { duration: 200 }) }],
  }));

  const closeDropdown = () => {
    setIsOpen(false);
    rotation.value = withTiming(0, { duration: 200 });
    dropdownOpacity.value = withTiming(0, { duration: 150 });
  };

  const toggleDropdown = () => {
    const next = !isOpen;
    setIsOpen(next);
    rotation.value = withTiming(next ? 180 : 0, { duration: 200 });
    dropdownOpacity.value = withTiming(next ? 1 : 0, { duration: next ? 200 : 150 });
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

    closeDropdown();
  };

  return (
    <View style={{ position: 'relative', zIndex: 50 }}>
      <View className="rounded-2xl bg-card">
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
      </View>

      {isOpen && (
        <>
          {/* Backdrop to close on outside tap */}
          <Pressable
            onPress={closeDropdown}
            style={{
              position: Platform.OS === 'web' ? 'fixed' : 'absolute',
              top: Platform.OS === 'web' ? 0 : -1000,
              left: Platform.OS === 'web' ? 0 : -1000,
              right: Platform.OS === 'web' ? 0 : -1000,
              bottom: Platform.OS === 'web' ? 0 : -1000,
              zIndex: 40,
            }}
          />
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 8,
                zIndex: 50,
                ...(Platform.OS === 'web'
                  ? ({
                      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                    } as object)
                  : {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 0.35,
                      shadowRadius: 20,
                      elevation: 10,
                    }),
              },
              dropdownAnimatedStyle,
            ]}
          >
            <View className="overflow-hidden rounded-2xl bg-card">
              {VAULTS.map((vault, index) => {
                const isSelected = vault.name === selectedVault.name;
                const isComingSoon = !!vault.isComingSoon && !isTestUser;
                return (
                  <Pressable
                    key={vault.name}
                    onPress={() => handleSelect(index)}
                    disabled={isComingSoon}
                    className="flex-row items-center justify-between gap-3 border-t border-border/40 px-5 py-4 web:hover:opacity-70"
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
        </>
      )}
    </View>
  );
};

export default VaultSelectorDropdown;
