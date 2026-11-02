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
import { useRhinoRowChainIds } from '@/hooks/useRhinoDepositAssets';
import { RHINO_NETWORK_CHIP } from '@/lib/rhinoDeposit';

const NETWORK_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type CardFundNetworksProps = {
  /** Stablecoin chosen on the previous step — scopes the chain list. */
  symbol: string;
  /**
   * One of the list's own rows. Every host shows the rhino.fi address for a row
   * rhino.fi serves (marked "via rhino.fi"), and the row's own otherwise.
   */
  onSelect: (chainId: number) => void;
  /** Chain whose session is currently being created. */
  loadingChainId?: number;
};

/**
 * Step 2 of the card funding flow — pick the chain to deposit `symbol` on. Only
 * the list's own chains are offered: rhino.fi adds none of its own.
 */
const CardFundNetworks = ({ symbol, onSelect, loadingChainId }: CardFundNetworksProps) => {
  const networks = useMemo(() => getCardFundNetworks(symbol), [symbol]);
  const rowChainIds = useMemo(() => networks.map(network => network.chainId), [networks]);
  const rhinoRows = useRhinoRowChainIds(
    { destinationType: CARD_FUND_DESTINATION_TYPE, symbol },
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
    </View>
  );
};

export default CardFundNetworks;
