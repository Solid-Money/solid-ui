import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type CardFundTurnOnBaseProps = {
  /** The network the deposit would be sent on, e.g. "BNB Chain". */
  networkName?: string;
  onTurnOn: () => void;
  isTurningOn: boolean;
  /** User-facing copy from the enable flow, when the last attempt failed. */
  error?: string;
  /** Back to network selection, where Fuse needs no Base. */
  onChangeNetwork: () => void;
};

/**
 * The card funding address step for a Wirex cardholder who has not turned Base
 * on, shown in place of the address for any network but Fuse.
 *
 * A deposit from there lands in their Safe on Base, which their card cannot
 * spend from until they turn Base on - so it asks for that one approval first,
 * and the address appears as soon as it is done. See `wirexBaseDepositGate`.
 */
const CardFundTurnOnBase = ({
  networkName,
  onTurnOn,
  isTurningOn,
  error,
  onChangeNetwork,
}: CardFundTurnOnBaseProps) => (
  <View className="gap-y-4">
    <View className="items-center gap-y-3 rounded-[15px] bg-card px-4 py-6">
      <Text className="text-center text-lg font-semibold text-white">
        Turn on Base for your card
      </Text>
      <Text className="text-center text-sm text-muted-foreground">
        {`Deposits sent on ${networkName ?? 'this network'} arrive in your wallet on Base. ` +
          'Your card can spend them once Base is turned on. It takes one approval.'}
      </Text>
      {error ? <Text className="text-center text-sm text-red-400">{error}</Text> : null}
    </View>

    <Button
      variant="brand"
      className="h-12 w-full rounded-full"
      onPress={onTurnOn}
      disabled={isTurningOn}
    >
      {isTurningOn ? (
        <ActivityIndicator color="black" />
      ) : (
        <Text className="text-base font-bold text-black">Turn on Base</Text>
      )}
    </Button>

    <Pressable
      className="items-center web:hover:opacity-70"
      onPress={onChangeNetwork}
      disabled={isTurningOn}
    >
      <Text className="text-sm text-white">Deposit on Fuse instead</Text>
    </Pressable>
  </View>
);

export default CardFundTurnOnBase;
