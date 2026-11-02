import React, { useState } from 'react';
import { Image } from 'expo-image';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import { getWalletDepositTokenIcon } from '@/components/DepositOption/WalletDepositAddress/constants';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useRhinoDepositChains } from '@/hooks/useRhinoDepositAssets';
import { track } from '@/lib/analytics';
import {
  getRhinoTokensForDestination,
  resolveRhinoTokenSymbol,
  RHINO_NETWORK_CHIP,
  RhinoDepositSelection,
} from '@/lib/rhinoDeposit';

import RhinoChainIcon from './RhinoChainIcon';

import type { RhinoDepositChain, RhinoDestinationType } from '@/lib/types';

const ICON_SIZE = 36;
const TOKEN_ICON_STYLE = { width: 28, height: 28, borderRadius: 14 };

type RhinoNetworkGroupProps = {
  destinationType: RhinoDestinationType;
  /** The token chosen on an earlier step; only chains taking it are listed. */
  symbol?: string;
  /** The savings vault being funded, for `PROTOCOL`. */
  vault?: string;
  onSelect: (selection: RhinoDepositSelection) => void;
  disabled?: boolean;
};

/**
 * The rhino.fi chains, listed under a funding flow's own networks: those with a
 * route to this destination (for the chosen token, when there is one). Renders
 * nothing when rhino.fi is not offered to this user or has no such chain.
 *
 * A chain taking more than one qualifying token opens a token choice under its
 * row; with one, the row selects it straight away.
 */
const RhinoNetworkGroup = ({
  destinationType,
  symbol,
  vault,
  onSelect,
  disabled,
}: RhinoNetworkGroupProps) => {
  const filter = { destinationType, symbol, vault };
  const { chains } = useRhinoDepositChains(filter);
  const [choosingChain, setChoosingChain] = useState<string | undefined>(undefined);

  if (!chains.length) return null;

  const select = (chain: RhinoDepositChain, tokenSymbol: string) => {
    track(TRACKING_EVENTS.DEPOSIT_RHINO_NETWORK_SELECTED, {
      deposit_method: 'rhino_deposit_address',
      destination_type: destinationType,
      rhino_chain: chain.chain,
      network_name: chain.name,
      token_symbol: tokenSymbol,
    });
    setChoosingChain(undefined);
    onSelect({ chain: chain.chain, tokenSymbol, destinationType, vault });
  };

  const handleChainPress = (chain: RhinoDepositChain) => {
    const tokenSymbol = resolveRhinoTokenSymbol(chain, filter);
    if (tokenSymbol) {
      select(chain, tokenSymbol);
      return;
    }
    setChoosingChain(current => (current === chain.chain ? undefined : chain.chain));
  };

  return (
    <CardFundGroup
      label="More networks"
      labelTooltip="Deposits on these networks are bridged to Solid by rhino.fi. Send only the token shown, within its limits."
      labelTooltipContext="rhino_deposit_networks"
    >
      {chains.flatMap(chain => [
        <CardFundRow
          key={chain.chain}
          icon={<RhinoChainIcon chain={chain.chain} name={chain.name} size={ICON_SIZE} />}
          title={chain.name}
          chips={[RHINO_NETWORK_CHIP]}
          chipsPosition="inline"
          onPress={() => handleChainPress(chain)}
          disabled={disabled}
        />,
        ...(choosingChain === chain.chain
          ? getRhinoTokensForDestination(chain, filter).map(token => (
              <CardFundRow
                key={`${chain.chain}-${token.symbol}`}
                icon={
                  <Image
                    source={getWalletDepositTokenIcon(token.symbol)}
                    style={TOKEN_ICON_STYLE}
                    contentFit="cover"
                  />
                }
                title={`Send ${token.symbol}`}
                subtitle={`on ${chain.name}`}
                onPress={() => select(chain, token.symbol)}
                disabled={disabled}
                className="pl-10"
              />
            ))
          : []),
      ])}
    </CardFundGroup>
  );
};

export default RhinoNetworkGroup;
