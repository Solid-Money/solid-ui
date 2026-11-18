import React, { ReactElement } from 'react';

import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useRhinoExtraNetworks } from '@/hooks/useRhinoDepositAssets';
import { track } from '@/lib/analytics';
import { getRhinoExtraSelection, RhinoDepositSelection } from '@/lib/rhinoDeposit';

import RhinoChainIcon from './RhinoChainIcon';

import type { RhinoDepositChain, RhinoDestinationType } from '@/lib/types';

const ICON_SIZE = 36;

type RhinoExtraNetworkRowsOptions = {
  destinationType: RhinoDestinationType;
  /** The token chosen on an earlier step; only chains taking it are listed. */
  symbol: string;
  /** The savings vault being funded, for `PROTOCOL`. */
  vault?: string;
  onSelect: (selection: RhinoDepositSelection) => void;
  disabled?: boolean;
};

/**
 * The rows for the rhino.fi chains the app has no row of its own for (Tron,
 * Solana, Bitcoin, Avalanche, …) with a route to this destination for the
 * chosen token (see `getRhinoExtraChains`). A funding flow lists them in the
 * same group as its own network rows, after them, with no section of their
 * own. Each row picks the user's rhino.fi address for that chain; nothing of
 * ours is minted for it.
 *
 * None until rhino.fi's routes are in, when they cannot be had (the list
 * already says so), and when no such chain takes the token: EURC to the card,
 * say, which rhino.fi does not route.
 */
export const useRhinoExtraNetworkRows = ({
  destinationType,
  symbol,
  vault,
  onSelect,
  disabled,
}: RhinoExtraNetworkRowsOptions): ReactElement[] => {
  const chains = useRhinoExtraNetworks({ destinationType, symbol, vault });

  const select = (chain: RhinoDepositChain) => {
    track(TRACKING_EVENTS.DEPOSIT_RHINO_NETWORK_SELECTED, {
      deposit_method: 'rhino_deposit_address',
      destination_type: destinationType,
      rhino_chain: chain.chain,
      network_name: chain.name,
      token_symbol: symbol,
    });
    onSelect(getRhinoExtraSelection(chain, { destinationType, symbol, vault }));
  };

  return chains.map(chain => (
    <CardFundRow
      key={chain.chain}
      icon={
        <RhinoChainIcon
          chain={chain.chain}
          chainId={chain.chainId}
          name={chain.name}
          size={ICON_SIZE}
        />
      }
      title={chain.name}
      onPress={() => select(chain)}
      disabled={disabled}
    />
  ));
};
