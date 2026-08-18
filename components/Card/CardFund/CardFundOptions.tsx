import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import FundExternalWallet from '@/assets/images/fund-external-wallet';
import FundMoveSavings from '@/assets/images/fund-move-savings';
import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import {
  CARD_FUND_TOKENS,
  CARD_FUND_USD_ICON,
  getCardFundNetworkChips,
} from '@/components/Card/CardFund/constants';
import { CARD_FUND_LOCAL_CURRENCIES } from '@/components/Card/CardFund/localCurrencies';
import NeedHelp from '@/components/NeedHelp';

const TOKEN_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type CardFundOptionsProps = {
  /** Stablecoin picked for the direct-deposit flow (USDC / USDT). */
  onTokenPress: (symbol: string) => void;
  onMoveFromSavingsPress: () => void;
  onExternalWalletPress: () => void;
  /** USD (ACH / Wire) — opens the virtual-account flow. */
  onUsdPress?: () => void;
  /**
   * A local currency (BRL, BDT…) — opens the buy-crypto onramp for it. Omit to
   * hide the local-currency rows entirely.
   */
  onLocalCurrencyPress?: (code: string) => void;
  isExternalWalletLoading?: boolean;
};

/** Step 1 of the card funding flow — "Fund your card". */
const CardFundOptions = ({
  onTokenPress,
  onMoveFromSavingsPress,
  onExternalWalletPress,
  onUsdPress,
  onLocalCurrencyPress,
  isExternalWalletLoading,
}: CardFundOptionsProps) => (
  <View className="gap-y-8">
    <CardFundGroup label="Stablecoins">
      {CARD_FUND_TOKENS.map(token => (
        <CardFundRow
          key={token.symbol}
          icon={<Image source={token.icon} style={TOKEN_ICON_STYLE} contentFit="cover" />}
          title={token.symbol}
          chips={getCardFundNetworkChips(token.symbol)}
          onPress={() => onTokenPress(token.symbol)}
        />
      ))}
    </CardFundGroup>

    <CardFundGroup label="Cash deposit">
      <CardFundRow
        icon={<Image source={CARD_FUND_USD_ICON} style={TOKEN_ICON_STYLE} contentFit="cover" />}
        title="USD"
        chips={['ACH', 'Wire']}
        onPress={onUsdPress}
      />
      {onLocalCurrencyPress
        ? CARD_FUND_LOCAL_CURRENCIES.map(currency => (
            <CardFundRow
              key={currency.code}
              icon={currency.icon}
              title={currency.code}
              onPress={() => onLocalCurrencyPress(currency.code)}
            />
          ))
        : null}
    </CardFundGroup>

    <CardFundGroup label="Other">
      <CardFundRow
        icon={<FundMoveSavings width={22} height={25} />}
        title="Move from wallet or savings"
        subtitle="Use funds you already hold in Solid"
        onPress={onMoveFromSavingsPress}
      />
      <CardFundRow
        icon={<FundExternalWallet width={26} height={26} />}
        title="Deposit from an external wallet"
        subtitle="Send USDC from any supported network"
        onPress={onExternalWalletPress}
        isLoading={isExternalWalletLoading}
      />
    </CardFundGroup>

    <View className="items-center">
      <NeedHelp />
    </View>
  </View>
);

export default CardFundOptions;
