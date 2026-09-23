import { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';

import {
  getWalletDepositNetworksForToken,
  resolveWalletDepositSymbol,
  WALLET_DEPOSIT_ESTIMATED_TIME,
} from './constants';

const NETWORK_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

/**
 * "Select chain" — opened from the address screen's network pill, to change the
 * chain the address was given by default.
 *
 * The address is the user's Safe and is the same on every chain, so this is not
 * choosing where the money lands. It settles the minimum transfer and which
 * chain the QR is labelled for, and only lists chains that carry the chosen
 * currency.
 */
const WalletDepositNetworks = () => {
  const setModal = useDepositStore(state => state.setModal);
  const setWalletDeposit = useDepositStore(state => state.setWalletDeposit);
  const symbol = useDepositStore(state => state.walletDeposit.symbol);
  const networks = useMemo(() => getWalletDepositNetworksForToken(symbol), [symbol]);

  const handleSelect = (chainId: number) => {
    track(TRACKING_EVENTS.NETWORK_SELECTED, {
      chain_id: chainId,
      deposit_type: 'wallet_deposit_address',
    });

    setWalletDeposit({ chainId, symbol: resolveWalletDepositSymbol(chainId, symbol) });
    setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  };

  return (
    <View>
      <CardFundGroup>
        {networks.map(network => (
          <CardFundRow
            key={network.chainId}
            icon={<Image source={network.icon} style={NETWORK_ICON_STYLE} contentFit="cover" />}
            title={network.name}
            chips={[WALLET_DEPOSIT_ESTIMATED_TIME]}
            chipsPosition="inline"
            onPress={() => handleSelect(network.chainId)}
          />
        ))}
      </CardFundGroup>
    </View>
  );
};

export default WalletDepositNetworks;
