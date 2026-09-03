import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import FundExternalWallet from '@/assets/images/fund-external-wallet';
import FundMoveSavings from '@/assets/images/fund-move-savings';
import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import {
  CARD_FUND_CASH_DEPOSIT_VISIBLE_ROWS,
  CARD_FUND_TOKENS,
  CARD_FUND_USD_ICON,
  CardFundSections,
  getCardFundNetworkChips,
  RAIN_CARD_FUND_SECTIONS,
} from '@/components/Card/CardFund/constants';
import { CARD_FUND_LOCAL_CURRENCIES } from '@/components/Card/CardFund/localCurrencies';
import NeedHelp from '@/components/NeedHelp';

const TOKEN_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type CardFundOptionsProps = {
  /** Stablecoin picked for the direct-deposit flow (USDC / USDT). */
  onTokenPress: (symbol: string) => void;
  onMoveFromSavingsPress?: () => void;
  onExternalWalletPress?: () => void;
  /** USD (ACH / Wire) — opens the virtual-account flow. */
  onUsdPress?: () => void;
  /**
   * A local currency (BRL, BDT…) — opens the buy-crypto onramp for it. Omit to
   * hide the local-currency rows entirely.
   */
  onLocalCurrencyPress?: (code: string) => void;
  isExternalWalletLoading?: boolean;
  /**
   * Which groups this issuer offers. Defaults to the full Rain set, so the
   * screen is unchanged for every caller that predates the Wirex flow.
   */
  sections?: CardFundSections;
};

/** Step 1 of the card funding flow — "Fund your card". */
const CardFundOptions = ({
  onTokenPress,
  onMoveFromSavingsPress,
  onExternalWalletPress,
  onUsdPress,
  onLocalCurrencyPress,
  isExternalWalletLoading,
  sections = RAIN_CARD_FUND_SECTIONS,
}: CardFundOptionsProps) => {
  // A local-currency row still needs its handler, so the section flag and the
  // callback both have to be present — the callback alone is how the Rain
  // desktop/mobile modals have always hidden these rows.
  const showLocalCurrencies = sections.localCurrencies && !!onLocalCurrencyPress;
  const showCashDeposit = sections.cashDeposit || showLocalCurrencies;
  const showOther = sections.moveFromSolid || sections.externalWallet;

  return (
    <View className="gap-y-8">
      {sections.stablecoins ? (
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
      ) : null}

      {showCashDeposit ? (
        <CardFundGroup label="Cash deposit" maxVisibleRows={CARD_FUND_CASH_DEPOSIT_VISIBLE_ROWS}>
          {sections.cashDeposit ? (
            <CardFundRow
              icon={
                <Image source={CARD_FUND_USD_ICON} style={TOKEN_ICON_STYLE} contentFit="cover" />
              }
              title="USD"
              chips={['ACH', 'Wire']}
              onPress={onUsdPress}
            />
          ) : null}
          {showLocalCurrencies
            ? CARD_FUND_LOCAL_CURRENCIES.map(currency => (
                <CardFundRow
                  key={currency.code}
                  icon={currency.icon}
                  title={currency.code}
                  onPress={() => onLocalCurrencyPress?.(currency.code)}
                />
              ))
            : null}
        </CardFundGroup>
      ) : null}

      {showOther ? (
        <CardFundGroup label="Other">
          {sections.moveFromSolid ? (
            <CardFundRow
              icon={<FundMoveSavings width={22} height={25} />}
              title="Move from wallet or savings"
              subtitle="Use funds you already hold in Solid"
              onPress={onMoveFromSavingsPress}
            />
          ) : null}
          {sections.externalWallet ? (
            <CardFundRow
              icon={<FundExternalWallet width={26} height={26} />}
              title="Deposit from an external wallet"
              subtitle="Send USDC from any supported network"
              onPress={onExternalWalletPress}
              isLoading={isExternalWalletLoading}
            />
          ) : null}
        </CardFundGroup>
      ) : null}

      <View className="items-center">
        <NeedHelp />
      </View>
    </View>
  );
};

export default CardFundOptions;
