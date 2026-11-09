import React from 'react';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useRhinoExtraNetworks } from '@/hooks/useRhinoDepositAssets';
import { track } from '@/lib/analytics';
import { getRhinoExtraSelection, RhinoDepositSelection } from '@/lib/rhinoDeposit';

import RhinoChainIcon from './RhinoChainIcon';

import type { RhinoDepositChain, RhinoDestinationType } from '@/lib/types';

const ICON_SIZE = 36;

type RhinoNetworkGroupProps = {
  destinationType: RhinoDestinationType;
  /** The token chosen on an earlier step; only chains taking it are listed. */
  symbol: string;
  /** The savings vault being funded, for `PROTOCOL`. */
  vault?: string;
  onSelect: (selection: RhinoDepositSelection) => void;
  disabled?: boolean;
};

/**
 * "More networks": under a funding flow's own network rows, the rhino.fi chains
 * the app has no row for (Tron, Solana, Avalanche, …) with a route to this
 * destination for the chosen token (see `getRhinoExtraChains`). Each row picks
 * the user's rhino.fi address for that chain; nothing of ours is minted for it.
 *
 * Renders nothing until rhino.fi's routes are in, when they cannot be had (the
 * list above already says so), and when no such chain takes the token: EURC to
 * the card, say, which rhino.fi does not route.
 */
const RhinoNetworkGroup = ({
  destinationType,
  symbol,
  vault,
  onSelect,
  disabled,
}: RhinoNetworkGroupProps) => {
  const chains = useRhinoExtraNetworks({ destinationType, symbol, vault });

  if (!chains.length) return null;

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

  return (
    <CardFundGroup
      label="More networks"
      labelTooltip={`Deposits on these networks are bridged to Solid by rhino.fi. Send only ${symbol}, within its limits.`}
      labelTooltipContext="rhino_deposit_networks"
    >
      {chains.map(chain => (
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
      ))}
    </CardFundGroup>
  );
};

export default RhinoNetworkGroup;
