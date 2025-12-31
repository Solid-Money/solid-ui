import DepositNetwork from '@/components/DepositNetwork/DepositNetwork';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDirectDepositSession } from '@/hooks/useDirectDepositSession';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';
import * as Sentry from '@sentry/react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Toast from 'react-native-toast-message';

const USDC_ICON = require('@/assets/images/usdc.png');
const USDT_ICON = require('@/assets/images/usdt.png');

type TokenOption = {
  symbol: 'USDC' | 'USDT';
  name: string;
  icon: any;
};

const DepositDirectlyTokens = () => {
  const { setModal, directDepositSession, setDirectDepositSession } = useDepositStore();
  const { user } = useUser();
  const { createDirectDepositSession, isLoading } = useDirectDepositSession();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  const chainId = directDepositSession.chainId || 1;
  const network = BRIDGE_TOKENS[chainId];

  // Get available tokens for this chain
  const availableTokens: TokenOption[] = [];

  if (network?.tokens?.USDC) {
    availableTokens.push({
      symbol: 'USDC',
      name: 'USD Coin',
      icon: USDC_ICON,
    });
  }

  if (network?.tokens?.USDT) {
    availableTokens.push({
      symbol: 'USDT',
      name: 'Tether USD',
      icon: USDT_ICON,
    });
  }

  const handleTokenSelect = async (token: TokenOption) => {
    try {
      setSelectedToken(token.symbol);

      // Track token selection
      track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        chain_id: chainId,
        token_symbol: token.symbol,
        deposit_type: 'direct_deposit',
        deposit_method: 'external_wallet_direct',
      });

      // Store selected token
      setDirectDepositSession({ selectedToken: token.symbol });

      // Create direct deposit session
      const session = await createDirectDepositSession(chainId, token.symbol);

      // Track session creation
      track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        session_id: session.sessionId,
        wallet_address: session.walletAddress,
        chain_id: chainId,
        token_symbol: token.symbol,
      });

      // Navigate to address display screen
      setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS);
    } catch (error) {
      console.error('Failed to create direct deposit session:', error);
      setSelectedToken(null);

      Sentry.captureException(error, {
        tags: {
          type: 'direct_deposit_session_error',
          chainId: chainId.toString(),
          token: token.symbol,
          userId: user?.userId,
        },
        extra: {
          chainId,
          token: token.symbol,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
        user: {
          id: user?.userId,
          address: user?.safeAddress,
        },
      });

      Toast.show({
        type: 'error',
        text1: 'Failed to create deposit session',
        text2: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  return (
    <View className="gap-y-2">
      <Text className="text-muted-foreground font-medium text-[1rem]">Choose a token</Text>

      <View className="gap-y-1.5">
        {availableTokens.map(token => {
          const isSelected = selectedToken === token.symbol;

          return (
            <DepositNetwork
              key={token.symbol}
              name={token.symbol}
              description=""
              icon={token.icon}
              onPress={() => handleTokenSelect(token)}
              isLoading={isLoading && isSelected}
              disabled={isLoading && isSelected}
            />
          );
        })}
      </View>
    </View>
  );
};

export default DepositDirectlyTokens;
