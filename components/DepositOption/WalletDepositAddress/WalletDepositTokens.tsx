import { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositStore } from '@/store/useDepositStore';

import { getDefaultWalletDepositSelection, getWalletDepositTokens } from './constants';

const TOKEN_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

/**
 * "Select token" — which currency the deposit address is for.
 *
 * Its own step rather than a dropdown on the address screen: the list has to sit
 * over a QR that fills most of the screen, and the same choice already has a
 * screen of its own for the chain. Two steps that behave the same way beat one
 * of each.
 */
const WalletDepositTokens = () => {
  const setModal = useDepositStore(state => state.setModal);
  const setWalletDeposit = useDepositStore(state => state.setWalletDeposit);
  const walletDeposit = useDepositStore(state => state.walletDeposit);

  const fallback = useMemo(() => getDefaultWalletDepositSelection(), []);
  const chainId = walletDeposit.chainId ?? fallback.chainId;
  const selected = walletDeposit.symbol ?? fallback.symbol;

  const tokens = useMemo(() => getWalletDepositTokens(chainId), [chainId]);

  const handleSelect = (symbol: string) => {
    setWalletDeposit({ symbol });
    setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  };

  return (
    <View>
      <CardFundGroup>
        {tokens.map(token => (
          <CardFundRow
            key={token.symbol}
            icon={<Image source={token.icon} style={TOKEN_ICON_STYLE} contentFit="cover" />}
            title={token.symbol}
            trailing={token.symbol === selected ? <Check size={20} color="#94F27F" /> : <View />}
            onPress={() => handleSelect(token.symbol)}
          />
        ))}
      </CardFundGroup>
    </View>
  );
};

export default WalletDepositTokens;
