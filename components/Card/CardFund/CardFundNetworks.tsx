import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import {
  CARD_FUND_ESTIMATED_TIME,
  CardFundNetwork,
  getCardFundNetworks,
  getCardFundRhinoDestination,
} from '@/components/Card/CardFund/constants';
import RhinoNetworksNotice from '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice';
import { useRhinoExtraNetworkRows } from '@/components/DepositOption/RhinoDeposit/useRhinoExtraNetworkRows';
import { useOfferedRhinoDepositAssets, useRhinoNetworkRows } from '@/hooks/useRhinoDepositAssets';
import {
  getRhinoAssetsNotice,
  getRhinoListNotice,
  isOfferedRhinoRow,
  RhinoDepositSelection,
  RhinoRowState,
} from '@/lib/rhinoDeposit';
import { CardProvider, RhinoDestinationType } from '@/lib/types';

const NETWORK_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type CardFundNetworksProps = {
  /** Token chosen on the previous step — scopes the chain list. */
  symbol: string;
  /**
   * The issuer the flow is for, which decides the rhino.fi route the rows are
   * matched against (see `getCardFundRhinoDestination`). Not needed when
   * `destinationType` names the route itself.
   */
  cardProvider?: CardProvider;
  /**
   * The rhino.fi destination the rows are matched against, for a flow that is
   * not funding the card (the AI API's), in place of the one `cardProvider`
   * decides.
   */
  destinationType?: RhinoDestinationType;
  /** The list's own chains, in place of the card's for `symbol` (`getCardFundNetworks`). */
  networks?: CardFundNetwork[];
  /**
   * Whether a row our own pipeline serves may be offered. Every one is, unless
   * this says otherwise: a flow whose own rows would land money where it can't
   * be used (the AI API's, on Fuse) lists them as rhino.fi's unrouted rows are.
   */
  isOwnRowOffered?: (chainId: number) => boolean;
  /**
   * One of the rows listed, which always has an address: rhino.fi's on every
   * chain but Base and Fuse, our own session on Base and Fuse. Every host shows the address of the row picked, and nothing else.
   */
  onSelect: (chainId: number) => void;
  /** A rhino.fi chain the app has no row of its own for (Tron, Solana, …). */
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
 * rather than an address of ours. After them, in the same list: the chains the
 * app has no row for that rhino.fi takes the token from (Tron, Solana, …).
 */
const NOT_ROUTED: RhinoRowState = { kind: 'none' };

const CardFundNetworks = ({
  symbol,
  cardProvider,
  destinationType: destinationTypeProp,
  networks: networksProp,
  isOwnRowOffered,
  onSelect,
  onSelectRhino,
  loadingChainId,
}: CardFundNetworksProps) => {
  const networks = useMemo(
    () => networksProp ?? getCardFundNetworks(symbol),
    [networksProp, symbol],
  );
  const destinationType = destinationTypeProp ?? getCardFundRhinoDestination(symbol, cardProvider);
  const { rows: resolvedRows, retry } = useRhinoNetworkRows({ destinationType, symbol }, networks);
  // An own row the flow cannot use is not offered, and is worded as one
  // rhino.fi has no route for, so an all-own list still says it is empty.
  const rows = useMemo(
    () =>
      isOwnRowOffered
        ? resolvedRows.map(entry =>
            entry.state.kind === 'own' && !isOwnRowOffered(entry.row.chainId)
              ? { ...entry, state: NOT_ROUTED }
              : entry,
          )
        : resolvedRows,
    [isOwnRowOffered, resolvedRows],
  );
  const { status: rhinoStatus } = useOfferedRhinoDepositAssets();
  const extraRows = useRhinoExtraNetworkRows({
    destinationType,
    symbol,
    onSelect: onSelectRhino,
    disabled: !!loadingChainId,
  });
  const offered = rows.filter(({ state }) => isOfferedRhinoRow(state));
  const listNotice = getRhinoListNotice(rows.map(({ state }) => state));
  // A token with no row of the list's own (BTC, only Bitcoin takes) waits on
  // rhino.fi's routes all the same; and a list with rhino.fi's other chains in
  // it is not empty.
  const rhinoNotice = getRhinoAssetsNotice(rhinoStatus);
  const notice =
    !networks.length && rhinoNotice
      ? rhinoNotice
      : listNotice === 'empty' && extraRows.length
        ? undefined
        : listNotice;

  return (
    <View className="gap-y-4">
      {offered.length || extraRows.length ? (
        <CardFundGroup>
          {offered.map(({ row: network }) => (
            <CardFundRow
              key={network.chainId}
              icon={<Image source={network.icon} style={NETWORK_ICON_STYLE} contentFit="cover" />}
              title={network.name}
              chips={[CARD_FUND_ESTIMATED_TIME]}
              chipsPosition="inline"
              onPress={() => onSelect(network.chainId)}
              disabled={
                network.isComingSoon || (!!loadingChainId && loadingChainId !== network.chainId)
              }
              isLoading={loadingChainId === network.chainId}
            />
          ))}
          {extraRows}
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
