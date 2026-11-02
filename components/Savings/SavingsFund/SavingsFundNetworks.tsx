import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

// The fund-flow list primitives are shared with the card funding flow.
import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import RhinoNetworkGroup from '@/components/DepositOption/RhinoDeposit/RhinoNetworkGroup';
import {
  getSavingsFundNetworks,
  getSavingsFundToken,
  SAVINGS_FUND_ESTIMATED_TIME,
} from '@/components/Savings/SavingsFund/constants';
import { useRhinoRowChainIds } from '@/hooks/useRhinoDepositAssets';
import { RHINO_NETWORK_CHIP, RhinoDepositSelection } from '@/lib/rhinoDeposit';

const NETWORK_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type SavingsFundNetworksProps = {
  /** Token chosen on the previous step — scopes the chain list. */
  symbol: string;
  onSelect: (chainId: number) => void;
  /** A rhino.fi chain from the group under the list. Omit to leave it out. */
  onSelectRhino?: (selection: RhinoDepositSelection) => void;
  /** Chain whose deposit address is currently being prepared. */
  loadingChainId?: number;
};

/**
 * Step 2 of the savings funding flow — pick the chain to deposit `symbol` on.
 *
 * A row rhino.fi serves into the same vault is marked "via rhino.fi": picking it
 * shows the rhino.fi address (see `useSavingsFundFlow.selectNetwork`). Under the
 * rows, the rhino.fi chains this list does not have.
 */
const SavingsFundNetworks = ({
  symbol,
  onSelect,
  onSelectRhino,
  loadingChainId,
}: SavingsFundNetworksProps) => {
  const networks = useMemo(() => getSavingsFundNetworks(symbol), [symbol]);
  const rowChainIds = useMemo(() => networks.map(network => network.chainId), [networks]);
  const vault = getSavingsFundToken(symbol).vaultToken;
  const rhinoRows = useRhinoRowChainIds(
    { destinationType: 'PROTOCOL', symbol, vault },
    rowChainIds,
  );

  return (
    <View className="gap-y-8">
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

      {/* rhino.fi chains taking this token into the same vault, when offered. */}
      {onSelectRhino ? (
        <RhinoNetworkGroup
          destinationType="PROTOCOL"
          symbol={symbol}
          vault={vault}
          excludeChainIds={rowChainIds}
          onSelect={onSelectRhino}
          disabled={!!loadingChainId}
        />
      ) : null}
    </View>
  );
};

export default SavingsFundNetworks;
