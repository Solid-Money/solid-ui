import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDown, Unlink, WalletMinimal } from 'lucide-react-native';
import { useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { eclipseAddress } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

import { Text } from './ui/text';

type ConnectedWalletDropdownProps = {
  chainId?: number;
};

const ConnectedWalletDropdown = ({ chainId }: ConnectedWalletDropdownProps = {}) => {
  const wallet = useActiveWallet();
  const activeAccount = useActiveAccount();
  const { disconnect } = useDisconnect();
  const [isOpen, setIsOpen] = useState(false);
  const srcChainId = useDepositStore(state => state.srcChainId);
  const address = activeAccount?.address;
  const effectiveChainId = chainId || srcChainId;
  const networkName = BRIDGE_TOKENS[effectiveChainId].name;

  const rotation = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const dropdownOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const dropdownHeight = useDerivedValue(() => {
    return isOpen ? contentHeight.value : 0;
  });

  const dropdownAnimatedStyle = useAnimatedStyle(() => {
    return {
      height: withTiming(dropdownHeight.value, { duration: 200 }),
      opacity: dropdownOpacity.value,
    };
  });

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    rotation.value = withTiming(isOpen ? 0 : 180, { duration: 200 });

    if (isOpen) {
      dropdownOpacity.value = withTiming(0, { duration: 150 });
    } else {
      dropdownOpacity.value = withTiming(1, { duration: 200 });
      track(TRACKING_EVENTS.WALLET_DROPDOWN_OPENED, {
        wallet_address: address,
        network: networkName,
      });
    }
  };

  return (
    <View className="rounded-2xl bg-accent">
      <Pressable
        className="flex-row items-center justify-between gap-2 px-5 py-4 web:hover:opacity-70"
        onPress={toggleDropdown}
      >
        <View className="flex-row items-center gap-4">
          <View>
            <WalletMinimal size={22} color="white" />
          </View>
          <Text className="text-base">
            {address ? eclipseAddress(address) : '0x'} ({networkName})
          </Text>
        </View>
        <Animated.View style={animatedStyle}>
          <ChevronDown color="white" size={20} />
        </Animated.View>
      </Pressable>
      <Animated.View style={dropdownAnimatedStyle} className="overflow-hidden">
        <Pressable
          className="flex-row items-center gap-4 border-t border-card px-5 py-4 web:hover:opacity-70"
          onPress={() => {
            if (wallet) {
              track(TRACKING_EVENTS.WALLET_DISCONNECTED, {
                wallet_address: address,
                network: networkName,
                wallet_type: wallet.id,
              });
              disconnect(wallet);
            }
          }}
          onLayout={event => {
            contentHeight.value = event.nativeEvent.layout.height;
          }}
        >
          <Unlink color="white" size={20} />
          <Text className="text-base">Disconnect</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

export default ConnectedWalletDropdown;
