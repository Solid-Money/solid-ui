import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { base } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import DepositNetwork from '@/components/DepositNetwork/DepositNetwork';
import RhinoNetworksNotice from '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardProvider } from '@/hooks/useCardProvider';
import {
  DEPOSIT_DIRECTLY_VAULT,
  getDepositDirectlyTokens,
  useDepositDirectlyRhino,
} from '@/hooks/useDepositDirectlyRhino';
import { useDirectDepositSession } from '@/hooks/useDirectDepositSession';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { showErrorToast } from '@/lib/errors';
import { getRhinoListNotice, isOfferedRhinoRow } from '@/lib/rhinoDeposit';
import {
  DEPOSIT_FREE_ON_BASE_LABEL,
  isDepositFreeOnBase,
  withBaseFirst,
} from '@/lib/utils/depositFee';
import { getAllowedTokensForChain, getVaultDepositConfig } from '@/lib/vaults';
import { useDepositStore } from '@/store/useDepositStore';

/**
 * "Deposit directly" (savings, web): pick the chain to send a stablecoin on.
 *
 * Every chain but Fuse is rhino.fi's soUSD route, which shows the user's
 * rhino.fi address; Fuse mints our own direct-deposit session, as before. A
 * chain with no address for any of its tokens is not offered, and while
 * rhino.fi's routes are not in, or cannot be had, a loader or a retry stands in
 * for them.
 *
 * Base is listed first, where soUSD mints, and marked free where the deposit
 * is (see `getDepositFeeRatePpm`).
 */
const DepositDirectlyNetworks = () => {
  const { setModal, setDirectDepositSession } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setDirectDepositSession: state.setDirectDepositSession,
    })),
  );
  const { user } = useUser();
  const { provider } = useCardProvider();
  const depositConfig = getVaultDepositConfig();
  const { createDirectDepositSession, isLoading } = useDirectDepositSession();
  const { rhino, openRhino, clearRhino } = useDepositDirectlyRhino();
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);

  const rows = useMemo(
    () =>
      withBaseFirst(
        Object.entries(BRIDGE_TOKENS)
          .sort((a, b) => a[1].sort - b[1].sort)
          .filter(([id]) => depositConfig.supportedChains.includes(Number(id)))
          .map(([id, network]) => {
            const chainId = Number(id);
            return {
              chainId,
              network,
              tokens: getDepositDirectlyTokens(rhino, chainId, getAllowedTokensForChain(chainId)),
            };
          })
          .filter(({ tokens }) => tokens.length > 0),
        ({ chainId }) => chainId,
      ),
    [depositConfig.supportedChains, rhino],
  );
  const isBaseFree = isDepositFreeOnBase({
    provider,
    product: 'savings',
    vaultToken: DEPOSIT_DIRECTLY_VAULT,
  });
  const offeredRows = rows.filter(({ tokens }) =>
    tokens.some(({ state }) => isOfferedRhinoRow(state)),
  );
  const notice = getRhinoListNotice(rows.flatMap(({ tokens }) => tokens.map(({ state }) => state)));

  const handlePress = async (id: number) => {
    try {
      setSelectedChainId(id);
      const network = BRIDGE_TOKENS[id];
      const offeredTokens = (rows.find(row => row.chainId === id)?.tokens ?? []).filter(
        ({ state }) => isOfferedRhinoRow(state),
      );

      // Track network selection
      track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        chain_id: id,
        network_name: network?.name,
        deposit_type: 'direct_deposit',
        deposit_method: 'external_wallet_direct',
      });

      // Store chainId in session
      setDirectDepositSession({ chainId: id });

      if (offeredTokens.length > 1) {
        // Navigate to token selection
        setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_TOKENS);
        setSelectedChainId(null);
      } else if (offeredTokens[0]?.state.kind === 'rhino') {
        // rhino.fi's address for it: no session to mint.
        setSelectedChainId(null);
        openRhino(offeredTokens[0].state.selection);
      } else if (offeredTokens[0]) {
        // Fuse: our own session, as before.
        const availableToken = offeredTokens[0].token;
        clearRhino();
        setDirectDepositSession({ selectedToken: availableToken });

        const session = await createDirectDepositSession(id, availableToken);

        // Track session creation
        track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
          user_id: user?.userId,
          safe_address: user?.safeAddress,
          session_id: session.sessionId,
          wallet_address: session.walletAddress,
          chain_id: id,
          token_symbol: availableToken,
        });

        // Navigate to address display screen
        setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS);
      } else {
        setSelectedChainId(null);
      }
    } catch (error) {
      console.error('Failed to create direct deposit session:', error);
      setSelectedChainId(null);

      // Reported (with a Ref) by the shared helper; no separate capture.
      void showErrorToast(error, {
        action: 'deposit',
        title: 'Couldn’t prepare your deposit',
        tags: { type: 'direct_deposit_session_error', chainId: id.toString() },
      });
    }
  };

  return (
    <View className="gap-y-2">
      <Text className="text-[1rem] font-medium text-muted-foreground">Choose a network</Text>

      <View className="gap-y-1.5">
        {offeredRows.map(({ chainId, network }) => {
          const isSelected = selectedChainId === chainId;
          const isComingSoon = network.isComingSoon;

          // Get estimated time: 5 min for Ethereum; else 30 min
          let estimatedTime = 'Estimated speed: 30 min';
          if (chainId === 1) estimatedTime = 'Estimated speed: 5 min';
          if (isBaseFree && chainId === base.id) {
            estimatedTime = `${DEPOSIT_FREE_ON_BASE_LABEL} · ${estimatedTime}`;
          }

          return (
            <DepositNetwork
              key={network.name}
              name={network.name}
              description={estimatedTime}
              icon={network.icon}
              isComingSoon={isComingSoon}
              onPress={() => handlePress(chainId)}
              isLoading={isLoading && isSelected}
              disabled={isLoading && isSelected}
            />
          );
        })}
        {notice ? (
          <RhinoNetworksNotice
            notice={notice}
            symbol="a stablecoin"
            hasRows={offeredRows.length > 0}
            onRetry={rhino.retry}
            className="rounded-[15px] bg-card"
          />
        ) : null}
      </View>
    </View>
  );
};

export default DepositDirectlyNetworks;
