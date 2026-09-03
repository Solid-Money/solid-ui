import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { WirexBankAccountType, WirexBankRailStatusDto } from '@/lib/types/wirex-bank';

import { canSendFrom } from './railPresentation';
import { WirexBankAccountDetails } from './WirexBankAccountDetails';
import { WirexBankTransferModal } from './WirexBankTransferModal';

export interface WirexBankAccountPaneProps {
  /** Which rail to open on. Defaults to the first with usable requisites. */
  initialAccountType?: WirexBankAccountType;
}

/**
 * The user's Wirex bank accounts, with the outbound-transfer flow attached.
 *
 * Receiving and sending are one screen because they are one account: the same
 * IBAN the user hands a payer is the account a payout is charged against. The
 * send button only appears once the rail can actually receive *and* the user
 * holds an outbound capability — Wirex gates those separately, and offering a
 * button that always 403s would be worse than not offering one.
 */
export const WirexBankAccountPane = ({ initialAccountType }: WirexBankAccountPaneProps = {}) => {
  const [sendingRail, setSendingRail] = useState<WirexBankRailStatusDto | null>(null);

  const renderFooter = useCallback((rail: WirexBankRailStatusDto) => {
    if (!canSendFrom(rail)) return null;

    return (
      <View className="pt-4">
        <Button className="h-12 w-full rounded-full" onPress={() => setSendingRail(rail)}>
          <Text className="text-base font-bold text-black">Send {rail.currency}</Text>
        </Button>
      </View>
    );
  }, []);

  if (sendingRail) {
    return <WirexBankTransferModal rail={sendingRail} onClose={() => setSendingRail(null)} />;
  }

  return (
    <WirexBankAccountDetails initialAccountType={initialAccountType} renderFooter={renderFooter} />
  );
};
