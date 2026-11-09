import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import DepositNetwork from '@/components/DepositNetwork/DepositNetwork';
import RhinoNetworksNotice from '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDepositDirectlyRhino } from '@/hooks/useDepositDirectlyRhino';
import { useDirectDepositSession } from '@/hooks/useDirectDepositSession';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { showErrorToast } from '@/lib/errors';
import {
  getRhinoListNotice,
  isOfferedRhinoRow,
  RHINO_NETWORK_CHIP,
  RhinoRowState,
} from '@/lib/rhinoDeposit';
import { getAllowedTokensForChain } from '@/lib/vaults';
import { useDepositStore } from '@/store/useDepositStore';

const USDC_ICON = getAsset('images/usdc.png');
const USDT_ICON = getAsset('images/usdt.png');

type TokenOption = {
  symbol: string;
  name: string;
  icon: any;
  /** How it is served on this chain: rhino.fi's soUSD route, or our session on Fuse. */
  state: RhinoRowState;
};

/**
 * "Deposit directly": the stablecoin to send on the chain already picked. Only
 * those with an address — rhino.fi's soUSD route off Fuse, our own session on
 * Fuse — and a loader or a retry while rhino.fi's routes cannot say.
 */
const DepositDirectlyTokens = () => {
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { setModal, directDepositSession, setDirectDepositSession } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      directDepositSession: state.directDepositSession,
      setDirectDepositSession: state.setDirectDepositSession,
    })),
  );
  const { user } = useUser();
  const { createDirectDepositSession, isLoading } = useDirectDepositSession();
  const { rhino, resolve, openRhino, clearRhino } = useDepositDirectlyRhino();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const hasTrackedTokenView = useRef(false);

  const chainId = directDepositSession.chainId || 1;
  const network = BRIDGE_TOKENS[chainId];

  // The tokens this chain carries, and how each is served there.
  const chainTokens = useMemo(() => {
    const allowedSymbols = getAllowedTokensForChain(chainId);

    return Object.entries(network?.tokens ?? {})
      .filter(([symbol]) => allowedSymbols.includes(symbol))
      .map(([symbol, token]): TokenOption => {
        const icon =
          token.icon || (symbol === 'USDT' ? USDT_ICON : symbol === 'USDC' ? USDC_ICON : USDC_ICON);
        return {
          symbol,
          name: token.fullName || token.name || symbol,
          icon,
          state: resolve(chainId, symbol),
        };
      });
  }, [chainId, network?.tokens, resolve]);
  const availableTokens = useMemo(
    () => chainTokens.filter(token => isOfferedRhinoRow(token.state)),
    [chainTokens],
  );
  const notice = getRhinoListNotice(chainTokens.map(token => token.state));

  // Track when token selection screen is viewed
  useEffect(() => {
    if (!hasTrackedTokenView.current && availableTokens.length > 0) {
      track(TRACKING_EVENTS.DEPOSIT_DIRECT_TOKEN_VIEWED, {
        deposit_method: 'deposit_directly',
        chain_id: chainId,
        network_name: network?.name,
        available_tokens: availableTokens.length,
        token_symbols: availableTokens.map(t => t.symbol).join(', '),
      });
      hasTrackedTokenView.current = true;
    }
  }, [availableTokens, chainId, network?.name]);

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

      // Track token selection specifically
      track(TRACKING_EVENTS.DEPOSIT_DIRECT_TOKEN_SELECTED, {
        deposit_method: 'deposit_directly',
        chain_id: chainId,
        network_name: network?.name,
        selected_token: token.symbol,
        token_name: token.name,
      });

      // rhino.fi's address for it: no session to mint.
      if (token.state.kind === 'rhino') {
        setSelectedToken(null);
        openRhino(token.state.selection);
        return;
      }

      // Fuse: our own session, as before.
      clearRhino();
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

      // Reported (with a Ref) by the shared helper; no separate capture.
      void showErrorToast(error, {
        action: 'deposit',
        title: 'Couldn’t prepare your deposit',
        tags: {
          type: 'direct_deposit_session_error',
          chainId: chainId.toString(),
          token: token.symbol,
        },
      });
    }
  };

  return (
    <View className="gap-y-2">
      <Text className="text-[1rem] font-medium text-muted-foreground">Choose a token</Text>

      <View className="gap-y-1.5">
        {availableTokens.map(token => {
          const isSelected = selectedToken === token.symbol;

          return (
            <DepositNetwork
              key={token.symbol}
              name={token.symbol}
              description={token.state.kind === 'rhino' ? RHINO_NETWORK_CHIP : ''}
              icon={token.icon}
              onPress={() => handleTokenSelect(token)}
              isLoading={isLoading && isSelected}
              disabled={isLoading && isSelected}
            />
          );
        })}
        {notice ? (
          <RhinoNetworksNotice
            notice={notice}
            symbol="a stablecoin"
            noun="tokens"
            hasRows={availableTokens.length > 0}
            onRetry={rhino.retry}
            className="rounded-[15px] bg-card"
          />
        ) : null}
      </View>
    </View>
  );
};

export default DepositDirectlyTokens;
