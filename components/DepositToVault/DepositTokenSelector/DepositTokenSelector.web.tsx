import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import DepositNetwork from '@/components/DepositNetwork/DepositNetwork';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { getAsset } from '@/lib/assets';
import { getAllowedTokensForChain } from '@/lib/vaults';
import { useDepositStore } from '@/store/useDepositStore';

const DepositTokenSelector = () => {
  const { setModal, setPrincipalToken, srcChainId, depositFromSolid } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setPrincipalToken: state.setPrincipalToken,
      srcChainId: state.srcChainId,
      depositFromSolid: state.depositFromSolid,
    })),
  );

  const { vault } = useVaultDepositConfig();
  const tokens = BRIDGE_TOKENS[srcChainId]?.tokens;
  // Only filter by vault when depositing to savings; show all tokens for Add Funds flow
  const allowedTokens = depositFromSolid
    ? getAllowedTokensForChain(srcChainId, vault)
    : Object.keys(tokens ?? {});

  const handlePress = (token: string) => {
    setPrincipalToken(token);
    setModal(DEPOSIT_MODAL.OPEN_FORM);
  };

  return (
    <View className="gap-y-2">
      <Text className="font-medium text-muted-foreground">Select a token</Text>

      <View className="gap-y-1.5">
        {Object.entries(tokens ?? {})
          .filter(([key]) => allowedTokens.includes(key))
          .map(([key, token]) => {
            return (
              <DepositNetwork
                key={key}
                name={token?.name || key}
                description={token?.fullName || 'USD Coin'}
                icon={token?.icon || getAsset('images/usdc.png')}
                isComingSoon={false}
                onPress={() => handlePress(key)}
              />
            );
          })}
      </View>
    </View>
  );
};

export default DepositTokenSelector;
