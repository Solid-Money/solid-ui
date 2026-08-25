import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import FundExternalWallet from '@/assets/images/fund-external-wallet';
import FundMoveSavings from '@/assets/images/fund-move-savings';
// The fund-flow list primitives are shared with the card funding flow.
import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import NeedHelp from '@/components/NeedHelp';
import {
  getSavingsFundNetworkChips,
  getSavingsFundTokenGroups,
} from '@/components/Savings/SavingsFund/constants';

import type { SavingsFundIntent } from '@/lib/types';

const TOKEN_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

type SavingsFundOptionsProps = {
  /** Token picked for the direct-deposit flow (USDC / USDT / ETH / FUSE). */
  onTokenPress: (symbol: string) => void;
  /** Deposit from the balance the user already holds in Solid. */
  onMoveFromWalletPress: () => void;
  /** Send from a connected external wallet. */
  onExternalWalletPress: () => void;
  isExternalWalletLoading?: boolean;
  /** Why the flow was opened — scopes which tokens are on offer. */
  intent?: SavingsFundIntent;
};

/** Step 1 of the savings funding flow — "Deposit to savings". */
const SavingsFundOptions = ({
  onTokenPress,
  onMoveFromWalletPress,
  onExternalWalletPress,
  isExternalWalletLoading,
  intent = 'savings',
}: SavingsFundOptionsProps) => {
  const { stablecoins, crypto } = getSavingsFundTokenGroups(intent);

  return (
    <View className="gap-y-8">
      <CardFundGroup label="Stablecoins">
        {stablecoins.map(token => (
          <CardFundRow
            key={token.symbol}
            icon={<Image source={token.icon} style={TOKEN_ICON_STYLE} contentFit="cover" />}
            title={token.symbol}
            chips={getSavingsFundNetworkChips(token.symbol)}
            onPress={() => onTokenPress(token.symbol)}
          />
        ))}
      </CardFundGroup>

      {crypto.length > 0 ? (
        <CardFundGroup label="Crypto">
          {crypto.map(token => (
            <CardFundRow
              key={token.symbol}
              icon={<Image source={token.icon} style={TOKEN_ICON_STYLE} contentFit="cover" />}
              title={token.symbol}
              subtitle={`Earns as ${token.vaultToken}`}
              chips={getSavingsFundNetworkChips(token.symbol)}
              onPress={() => onTokenPress(token.symbol)}
            />
          ))}
        </CardFundGroup>
      ) : null}

      <CardFundGroup label="Other">
        <CardFundRow
          icon={<FundMoveSavings width={22} height={25} />}
          title="Move from wallet or savings"
          subtitle="Use funds you already hold in Solid"
          onPress={onMoveFromWalletPress}
        />
        <CardFundRow
          icon={<FundExternalWallet width={26} height={26} />}
          title="Deposit from an external wallet"
          subtitle="Send from any supported network"
          onPress={onExternalWalletPress}
          isLoading={isExternalWalletLoading}
        />
      </CardFundGroup>

      <View className="items-center">
        <NeedHelp />
      </View>
    </View>
  );
};

export default SavingsFundOptions;
