import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { base, mainnet } from 'viem/chains';
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
import { useDepositStore } from '@/store/useDepositStore';

const ESTIMATED_TIMES: Record<number, string> = {
  [mainnet.id]: 'Estimated speed: 5 min',
};
const DEFAULT_ESTIMATED_TIME = 'Estimated speed: 30 min';

/** A row's line, led by "Free" on Base where a soUSD deposit there is. */
const withFreeOnBase = (description: string, isFree: boolean): string =>
  isFree ? `${DEPOSIT_FREE_ON_BASE_LABEL} · ${description}` : description;

/** The stablecoins a chain carries, in the order the token step lists them. */
const DEPOSIT_DIRECTLY_TOKENS = ['USDC', 'USDT'];

/**
 * "Deposit directly" (savings, mobile): pick the chain to send USDC or USDT on.
 *
 * Every chain but Fuse is rhino.fi's soUSD route, which shows the user's
 * rhino.fi address; Fuse mints our own direct-deposit session, as before. A
 * chain with no address for either token is not offered, and while rhino.fi's
 * routes are not in, or cannot be had, a loader or a retry stands in for them.
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
  const { createDirectDepositSession, isLoading } = useDirectDepositSession();
  const { rhino, openRhino, clearRhino } = useDepositDirectlyRhino();
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const hasTrackedNetworkView = useRef(false);

  const rows = useMemo(
    () =>
      withBaseFirst(
        Object.entries(BRIDGE_TOKENS)
          .sort((a, b) => a[1].sort - b[1].sort)
          .map(([id, network]) => {
            const chainId = Number(id);
            const tokens = getDepositDirectlyTokens(
              rhino,
              chainId,
              DEPOSIT_DIRECTLY_TOKENS.filter(token => network.tokens?.[token]),
            );
            return { chainId, network, tokens };
          }),
        ({ chainId }) => chainId,
      ),
    [rhino],
  );
  const isBaseFree = isDepositFreeOnBase({
    provider,
    product: 'savings',
    vaultToken: DEPOSIT_DIRECTLY_VAULT,
  });
  const sortedNetworks = useMemo(
    () =>
      rows
        .filter(({ tokens }) => tokens.some(({ state }) => isOfferedRhinoRow(state)))
        .map(({ chainId, network }) => [String(chainId), network] as const),
    [rows],
  );
  const notice = getRhinoListNotice(rows.flatMap(({ tokens }) => tokens.map(({ state }) => state)));

  // Track when network selection screen is viewed
  useEffect(() => {
    if (!hasTrackedNetworkView.current) {
      track(TRACKING_EVENTS.DEPOSIT_DIRECT_NETWORK_VIEWED, {
        deposit_method: 'deposit_directly',
        available_networks: sortedNetworks.length,
        network_names: sortedNetworks.map(([, n]) => n.name).join(', '),
      });
      hasTrackedNetworkView.current = true;
    }
  }, [sortedNetworks]);

  const handlePress = async (chainId: number) => {
    const network = BRIDGE_TOKENS[chainId];
    const offeredTokens = (rows.find(row => row.chainId === chainId)?.tokens ?? []).filter(
      ({ state }) => isOfferedRhinoRow(state),
    );

    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      chain_id: chainId,
      network_name: network?.name,
      deposit_type: 'direct_deposit',
      deposit_method: 'external_wallet_direct',
    });

    // Track network selection specifically
    track(TRACKING_EVENTS.DEPOSIT_DIRECT_NETWORK_SELECTED, {
      deposit_method: 'deposit_directly',
      chain_id: chainId,
      network_name: network?.name,
      estimated_time: ESTIMATED_TIMES[chainId] ?? DEFAULT_ESTIMATED_TIME,
      has_multiple_tokens: offeredTokens.length > 1,
    });

    try {
      setSelectedChainId(chainId);

      // Store chainId in session
      setDirectDepositSession({ chainId });

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

        const session = await createDirectDepositSession(chainId, availableToken);

        track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
          user_id: user?.userId,
          safe_address: user?.safeAddress,
          session_id: session.sessionId,
          wallet_address: session.walletAddress,
          chain_id: chainId,
          network_name: network?.name,
          token_symbol: availableToken,
          deposit_type: 'direct_deposit',
        });

        setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS);
      } else {
        setSelectedChainId(null);
      }
    } catch (error) {
      console.error('Failed to create direct deposit session:', error);
      setSelectedChainId(null);
      void showErrorToast(error, {
        action: 'deposit',
        title: 'Couldn’t prepare your deposit',
        tags: { type: 'direct_deposit_session_error' },
      });
    }
  };

  return (
    <View className="gap-y-2">
      <Text className="text-[1rem] font-medium text-muted-foreground">Choose a network</Text>

      <View className="gap-y-1.5">
        {sortedNetworks.map(([id, network]) => {
          const chainId = Number(id);
          return (
            <DepositNetwork
              key={chainId}
              name={network.name}
              description={withFreeOnBase(
                ESTIMATED_TIMES[chainId] ?? DEFAULT_ESTIMATED_TIME,
                isBaseFree && chainId === base.id,
              )}
              icon={network.icon}
              isComingSoon={network.isComingSoon}
              onPress={() => handlePress(chainId)}
              disabled={isLoading}
              isLoading={isLoading && selectedChainId === chainId}
            />
          );
        })}
        {notice ? (
          <RhinoNetworksNotice
            notice={notice}
            symbol="USDC or USDT"
            hasRows={sortedNetworks.length > 0}
            onRetry={rhino.retry}
            className="rounded-[15px] bg-card"
          />
        ) : null}
      </View>
    </View>
  );
};

export default DepositDirectlyNetworks;
