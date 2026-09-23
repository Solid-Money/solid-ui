import { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositStore } from '@/store/useDepositStore';

import {
  getAllWalletDepositTokens,
  getDefaultWalletDepositSelection,
  resolveWalletDepositChain,
} from './constants';

const TOKEN_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

/**
 * "Select token" — which currency the deposit address is for, and the first step
 * after "Show deposit address".
 *
 * It lists every currency some chain accepts. The chain follows from the pick
 * (see `resolveWalletDepositChain`), and the address screen's network pill is
 * there to change it.
 */
const WalletDepositTokens = () => {
  const setModal = useDepositStore(state => state.setModal);
  const setWalletDeposit = useDepositStore(state => state.setWalletDeposit);
  const walletDeposit = useDepositStore(state => state.walletDeposit);

  const fallback = useMemo(() => getDefaultWalletDepositSelection(), []);
  const selected = walletDeposit.symbol ?? fallback.symbol;

  const tokens = useMemo(() => getAllWalletDepositTokens(), []);

  const handleSelect = (symbol: string) => {
    setWalletDeposit({
      symbol,
      chainId: resolveWalletDepositChain(symbol, walletDeposit.chainId),
      isChangingToken: false,
    });
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
