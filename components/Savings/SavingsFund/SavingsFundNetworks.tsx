import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

// The fund-flow list primitives are shared with the card funding flow.
import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import {
  getSavingsFundNetworks,
  getSavingsFundToken,
  SAVINGS_FUND_ESTIMATED_TIME,
} from '@/components/Savings/SavingsFund/constants';
import { useRhinoRowChainIds } from '@/hooks/useRhinoDepositAssets';
import { RHINO_NETWORK_CHIP } from '@/lib/rhinoDeposit';

const NETWORK_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type SavingsFundNetworksProps = {
  /** Token chosen on the previous step — scopes the chain list. */
  symbol: string;
  onSelect: (chainId: number) => void;
  /** Chain whose deposit address is currently being prepared. */
  loadingChainId?: number;
};

/**
 * Step 2 of the savings funding flow — pick the chain to deposit `symbol` on.
 *
 * A row rhino.fi serves into the same vault is marked "via rhino.fi": picking it
 * shows the rhino.fi address (see `useSavingsFundFlow.selectNetwork`). Only the
 * list's own chains are offered: rhino.fi adds none of its own.
 */
const SavingsFundNetworks = ({ symbol, onSelect, loadingChainId }: SavingsFundNetworksProps) => {
  const networks = useMemo(() => getSavingsFundNetworks(symbol), [symbol]);
  const rowChainIds = useMemo(() => networks.map(network => network.chainId), [networks]);
  const vault = getSavingsFundToken(symbol).vaultToken;
  const rhinoRows = useRhinoRowChainIds(
    { destinationType: 'PROTOCOL', symbol, vault },
    rowChainIds,
  );

  return (
    <View>
      <CardFundGroup>
        {networks.map(network => (
          <CardFundRow
            key={network.chainId}
            icon={<Image source={network.icon} style={NETWORK_ICON_STYLE} contentFit="cover" />}
            title={network.name}
            chips={
              rhinoRows.has(network.chainId)
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
    </View>
  );
};

export default SavingsFundNetworks;
