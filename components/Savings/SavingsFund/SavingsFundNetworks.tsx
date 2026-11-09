import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

// The fund-flow list primitives are shared with the card funding flow.
import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import RhinoNetworkGroup from '@/components/DepositOption/RhinoDeposit/RhinoNetworkGroup';
import RhinoNetworksNotice from '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice';
import {
  getSavingsFundNetworks,
  getSavingsFundToken,
  SAVINGS_FUND_ESTIMATED_TIME,
} from '@/components/Savings/SavingsFund/constants';
import { useRhinoNetworkRows } from '@/hooks/useRhinoDepositAssets';
import {
  getRhinoListNotice,
  isOfferedRhinoRow,
  RHINO_NETWORK_CHIP,
  RhinoDepositSelection,
} from '@/lib/rhinoDeposit';

const NETWORK_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type SavingsFundNetworksProps = {
  /** Token chosen on the previous step — scopes the chain list. */
  symbol: string;
  onSelect: (chainId: number) => void;
  /** A "More networks" chain from the group under the list. */
  onSelectRhino: (selection: RhinoDepositSelection) => void;
  /** Chain whose deposit address is currently being prepared. */
  loadingChainId?: number;
};

/**
 * Step 2 of the savings funding flow — pick the chain to deposit `symbol` on.
 *
 * Only the list's own chains, and of those only the ones with an address: Fuse,
 * and the chains rhino.fi has a route from into the vault the token funds,
 * marked "via rhino.fi" (see `useSavingsFundFlow.selectNetwork`). Until those
 * routes are in, or when they cannot be had, a loader or a retry stands in for
 * them rather than a direct-deposit session.
 *
 * Under the list, "More networks": the chains the app has no row for that
 * rhino.fi takes the token from into the same vault (Tron USDT into soUSD, …).
 */
const SavingsFundNetworks = ({
  symbol,
  onSelect,
  onSelectRhino,
  loadingChainId,
}: SavingsFundNetworksProps) => {
  const networks = useMemo(() => getSavingsFundNetworks(symbol), [symbol]);
  const vault = getSavingsFundToken(symbol).vaultToken;
  const { rows, retry } = useRhinoNetworkRows(
    { destinationType: 'PROTOCOL', symbol, vault },
    networks,
  );
  const offered = rows.filter(({ state }) => isOfferedRhinoRow(state));
  const notice = getRhinoListNotice(rows.map(({ state }) => state));

  return (
    <View className="gap-y-4">
      {offered.length ? (
        <CardFundGroup>
          {offered.map(({ row: network, state }) => (
            <CardFundRow
              key={network.chainId}
              icon={<Image source={network.icon} style={NETWORK_ICON_STYLE} contentFit="cover" />}
              title={network.name}
              chips={
                state.kind === 'rhino'
                  ? [SAVINGS_FUND_ESTIMATED_TIME, RHINO_NETWORK_CHIP]
                  : [SAVINGS_FUND_ESTIMATED_TIME]
              }
              chipsPosition="inline"
              onPress={() => onSelect(network.chainId)}
              disabled={
                network.isComingSoon || (!!loadingChainId && loadingChainId !== network.chainId)
              }
              isLoading={loadingChainId === network.chainId}
            />
          ))}
        </CardFundGroup>
      ) : null}
      {notice ? (
        <RhinoNetworksNotice
          notice={notice}
          symbol={symbol}
          hasRows={offered.length > 0}
          onRetry={retry}
          className="rounded-[15px] bg-card"
        />
      ) : null}
      <RhinoNetworkGroup
        destinationType="PROTOCOL"
        symbol={symbol}
        vault={vault}
        onSelect={onSelectRhino}
        disabled={!!loadingChainId}
      />
    </View>
  );
};

export default SavingsFundNetworks;
