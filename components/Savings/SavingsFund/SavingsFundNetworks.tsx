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
import { RhinoDepositSelection } from '@/lib/rhinoDeposit';

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

/** Step 2 of the savings funding flow — pick the chain to deposit `symbol` on. */
const SavingsFundNetworks = ({
  symbol,
  onSelect,
  onSelectRhino,
  loadingChainId,
}: SavingsFundNetworksProps) => {
  const networks = useMemo(() => getSavingsFundNetworks(symbol), [symbol]);

  return (
    <View className="gap-y-8">
      <CardFundGroup>
        {networks.map(network => (
          <CardFundRow
            key={network.chainId}
            icon={<Image source={network.icon} style={NETWORK_ICON_STYLE} contentFit="cover" />}
            title={network.name}
            chips={[SAVINGS_FUND_ESTIMATED_TIME]}
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
          vault={getSavingsFundToken(symbol).vaultToken}
          onSelect={onSelectRhino}
          disabled={!!loadingChainId}
        />
      ) : null}
    </View>
  );
};

export default SavingsFundNetworks;
