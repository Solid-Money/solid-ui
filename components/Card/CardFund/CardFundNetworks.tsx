import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import {
  CARD_FUND_ESTIMATED_TIME,
  getCardFundNetworks,
  getCardFundRhinoDestination,
} from '@/components/Card/CardFund/constants';
import RhinoNetworkGroup from '@/components/DepositOption/RhinoDeposit/RhinoNetworkGroup';
import RhinoNetworksNotice from '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice';
import { useRhinoNetworkRows } from '@/hooks/useRhinoDepositAssets';
import {
  getRhinoListNotice,
  isOfferedRhinoRow,
  RHINO_NETWORK_CHIP,
  RhinoDepositSelection,
} from '@/lib/rhinoDeposit';
import { CardProvider } from '@/lib/types';

const NETWORK_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type CardFundNetworksProps = {
  /** Stablecoin chosen on the previous step — scopes the chain list. */
  symbol: string;
  /**
   * The issuer the flow is for, which decides the rhino.fi route the rows are
   * matched against (see `getCardFundRhinoDestination`).
   */
  cardProvider: CardProvider;
  /**
   * One of the rows listed, which always has an address: rhino.fi's (marked
   * "via rhino.fi") on every chain but Fuse, our own session on Fuse and for
   * USDT. Every host shows the address of the row picked, and nothing else.
   */
  onSelect: (chainId: number) => void;
  /** A "More networks" chain from the group under the list. */
  onSelectRhino: (selection: RhinoDepositSelection) => void;
  /** Chain whose session is currently being created. */
  loadingChainId?: number;
};

/**
 * Step 2 of the card funding flow — pick the chain to deposit `symbol` on.
 *
 * The list's own chains, and of those only the ones with an address: Fuse, USDT
 * on each chain our pipeline takes it on, and the chains rhino.fi has a route
 * from for this issuer (see `useRhinoNetworkRows`). Until rhino.fi's routes are
 * in, or when they cannot be had, a loader or a retry stands in for its rows
 * rather than an address of ours. Under them, "More networks": the chains the
 * app has no row for that rhino.fi takes the token from (Tron, Solana, …).
 */
const CardFundNetworks = ({
  symbol,
  cardProvider,
  onSelect,
  onSelectRhino,
  loadingChainId,
}: CardFundNetworksProps) => {
  const networks = useMemo(() => getCardFundNetworks(symbol), [symbol]);
  const destinationType = getCardFundRhinoDestination(symbol, cardProvider);
  const { rows, retry } = useRhinoNetworkRows({ destinationType, symbol }, networks);
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
                  ? [CARD_FUND_ESTIMATED_TIME, RHINO_NETWORK_CHIP]
                  : [CARD_FUND_ESTIMATED_TIME]
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
        destinationType={destinationType}
        symbol={symbol}
        onSelect={onSelectRhino}
        disabled={!!loadingChainId}
      />
    </View>
  );
};

export default CardFundNetworks;
