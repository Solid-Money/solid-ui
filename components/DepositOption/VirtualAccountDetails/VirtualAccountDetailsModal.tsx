import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';

import { BankAccountDetailsView } from './BankAccountDetailsView';

interface VirtualAccountDetailsModalProps {
  /**
   * Called when the user taps "Try again" after failing to load details.
   * Defaults to a plain refetch of the existing automation; pass this to
   * route through account creation/ToS instead when embedded somewhere that
   * a user may not have an automation yet (e.g. the wallet deposit flow).
   */
  onRetry?: () => void;
}

export const VirtualAccountDetailsModal = ({ onRetry }: VirtualAccountDetailsModalProps = {}) => {
  const { data: automation, isLoading, refetch } = useOnrampAutomation();

  // The user reaching their bank details is what "the virtual account works"
  // means; a load failure here is a dead end with an account already issued.
  useEffect(() => {
    if (isLoading) return;
    track(
      automation
        ? TRACKING_EVENTS.VIRTUAL_ACCOUNT_DETAILS_VIEWED
        : TRACKING_EVENTS.VIRTUAL_ACCOUNT_DETAILS_LOAD_FAILED,
    );
  }, [automation, isLoading]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator />
      </View>
    );
  }

  if (!automation) {
    return (
      <View className="flex-1 items-center justify-center gap-4 py-12">
        <Text className="text-base text-white">Could not load your bank details.</Text>
        <Button className="h-12 rounded-2xl px-6" onPress={() => (onRetry ? onRetry() : refetch())}>
          <Text className="text-base font-bold text-black">Try again</Text>
        </Button>
      </View>
    );
  }

  const { depositAddress } = automation;

  return (
    <BankAccountDetailsView
      flag={getAsset('images/us.png')}
      title="Virtual USD account"
      blurb="Get bank transfers directly to your solid account with ACH and Wire"
      rows={[
        { label: 'Beneficiary name', value: depositAddress.beneficiaryName },
        { label: 'Beneficiary address', value: depositAddress.beneficiaryAddress },
        { label: 'Bank name', value: depositAddress.beneficiaryBankName },
        { label: 'Bank address', value: depositAddress.beneficiaryBankAddress },
        { label: 'Account number', value: depositAddress.accountNumber },
        { label: 'Routing number', value: depositAddress.routingNumber },
      ]}
      // Which field was copied says whether the user is wiring or setting up an
      // ACH pull — the value itself is never sent.
      onCopyField={field => track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_DETAIL_COPIED, { field })}
    />
  );
};
