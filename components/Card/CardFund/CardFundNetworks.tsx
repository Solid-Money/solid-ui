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
import RhinoNetworksNotice from '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice';
import { useRhinoNetworkRows } from '@/hooks/useRhinoDepositAssets';
import { getRhinoListNotice, isOfferedRhinoRow, RHINO_NETWORK_CHIP } from '@/lib/rhinoDeposit';

const NETWORK_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type CardFundNetworksProps = {
  /** Stablecoin chosen on the previous step — scopes the chain list. */
  symbol: string;
  /**
   * One of the rows listed, which always has an address: rhino.fi's (marked
   * "via rhino.fi") on every chain but Fuse, our own session on Fuse. Every host
   * shows the address of the row picked, and nothing else.
   */
  onSelect: (chainId: number) => void;
  /** Chain whose session is currently being created. */
  loadingChainId?: number;
};

/**
 * Step 2 of the card funding flow — pick the chain to deposit `symbol` on.
 *
 * Only the list's own chains, and of those only the ones with an address: Fuse,
 * and the chains rhino.fi has a card route from (see `useRhinoNetworkRows`).
 * Until rhino.fi's routes are in, or when they cannot be had, a loader or a
 * retry stands in for its rows rather than an address of ours.
 */
const CardFundNetworks = ({ symbol, onSelect, loadingChainId }: CardFundNetworksProps) => {
  const networks = useMemo(() => getCardFundNetworks(symbol), [symbol]);
  const { rows, retry } = useRhinoNetworkRows(
    { destinationType: getCardFundRhinoDestination(symbol), symbol },
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
    </View>
  );
};

export default CardFundNetworks;
