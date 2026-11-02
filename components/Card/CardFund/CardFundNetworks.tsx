import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import {
  CARD_FUND_DESTINATION_TYPE,
  CARD_FUND_ESTIMATED_TIME,
  getCardFundNetworks,
} from '@/components/Card/CardFund/constants';
import RhinoNetworkGroup from '@/components/DepositOption/RhinoDeposit/RhinoNetworkGroup';
import { RhinoDepositSelection } from '@/lib/rhinoDeposit';

const NETWORK_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type CardFundNetworksProps = {
  /** Stablecoin chosen on the previous step — scopes the chain list. */
  symbol: string;
  onSelect: (chainId: number) => void;
  /** A rhino.fi chain from the group under the list. Omit to leave it out. */
  onSelectRhino?: (selection: RhinoDepositSelection) => void;
  /** Chain whose session is currently being created. */
  loadingChainId?: number;
};

/** Step 2 of the card funding flow — pick the chain to deposit `symbol` on. */
const CardFundNetworks = ({
  symbol,
  onSelect,
  onSelectRhino,
  loadingChainId,
}: CardFundNetworksProps) => {
  const networks = useMemo(() => getCardFundNetworks(symbol), [symbol]);

  return (
    <View className="gap-y-8">
      <CardFundGroup>
        {networks.map(network => (
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
      </CardFundGroup>

      {/* rhino.fi chains taking this stablecoin to the card, when offered. */}
      {onSelectRhino ? (
        <RhinoNetworkGroup
          destinationType={CARD_FUND_DESTINATION_TYPE}
          symbol={symbol}
          onSelect={onSelectRhino}
          disabled={!!loadingChainId}
        />
      ) : null}
    </View>
  );
};

export default CardFundNetworks;
