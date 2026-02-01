import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { track } from '@/lib/analytics';
import { getAllowedTokensForChain } from '@/lib/vaults';
import { useDepositStore } from '@/store/useDepositStore';

import DepositNetwork from './DepositNetwork';

const DepositNetworks = () => {
  const { setModal, setSrcChainId, setOutputToken } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setSrcChainId: state.setSrcChainId,
      setOutputToken: state.setOutputToken,
    })),
  );
  const { user } = useUser();
  const { vault, depositConfig } = useVaultDepositConfig();
  const hasTrackedNetworkView = useRef(false);
  const supportedChains = depositConfig.supportedChains;

  // Track when wallet network selection screen is viewed
  useEffect(() => {
    if (!hasTrackedNetworkView.current) {
      const networksCount = supportedChains.length;
      track(TRACKING_EVENTS.DEPOSIT_WALLET_NETWORK_VIEWED, {
        deposit_method: 'wallet',
        available_networks: networksCount,
        vault: vault.name,
      });
      hasTrackedNetworkView.current = true;
    }
  }, [supportedChains.length, vault.name]);

  const handlePress = (id: number) => {
    const network = BRIDGE_TOKENS[id];
    const allowedTokens = getAllowedTokensForChain(id, vault);
    const selectedToken = allowedTokens[0] || 'USDC';

    // Track network selection
    track(TRACKING_EVENTS.NETWORK_SELECTED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      chain_id: id,
      network_name: network?.name,
      deposit_type: 'connected_wallet',
      deposit_method: 'cross_chain_bridge',
      vault: vault.name,
    });

    // Track wallet network selection specifically
    track(TRACKING_EVENTS.DEPOSIT_WALLET_NETWORK_SELECTED, {
      deposit_method: 'wallet',
      chain_id: id,
      network_name: network?.name,
      estimated_time: id === 1 ? '5 min' : '20 min',
      vault: vault.name,
    });

    setSrcChainId(id);
    setOutputToken(selectedToken);
    setModal(DEPOSIT_MODAL.OPEN_FORM);
  };

  return (
    <View className="gap-y-2">
      <Text className="text-[1rem] font-medium text-muted-foreground">Choose a network</Text>

      <View className="gap-y-1.5">
        {Object.entries(BRIDGE_TOKENS)
          .sort((a, b) => a[1].sort - b[1].sort)
          .filter(([id]) => supportedChains.includes(Number(id)))
          .filter(([id]) => getAllowedTokensForChain(Number(id), vault).length > 0)
          .map(([id, network]) => {
            const isEthereum = Number(id) === 1;
            const isComingSoon = network.isComingSoon;

            return (
              <DepositNetwork
                key={network.name}
                name={network.name}
                description={isEthereum ? 'Estimated speed: 5 min' : 'Estimated speed: 20 min'}
                icon={network.icon}
                isComingSoon={isComingSoon}
                onPress={() => handlePress(Number(id))}
              />
            );
          })}
      </View>
    </View>
  );
};

export default DepositNetworks;
