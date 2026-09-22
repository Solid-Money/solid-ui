import { useEffect } from 'react';
import { View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';

import NeedHelp from '@/components/NeedHelp';
import { useOrchestraNavigation } from '@/components/Orchestra/OrchestraNavigation';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { orchestraErrorTitle } from '@/lib/orchestraErrors';
import { useOrchestraStore } from '@/store/useOrchestraStore';

/**
 * Failure screen for the Lightning onramp.
 *
 * The button is chosen by the error's `action`, not by which step raised it: a
 * refusal the user can fix by typing a different number goes back to the amount
 * box, and one they cannot fix — an unroutable corridor, a key the dashboard has
 * to change — offers support and the way out instead of a retry that can only
 * fail the same way.
 */
export const OrchestraError = () => {
  const setModal = useOrchestraNavigation();
  const error = useOrchestraStore(state => state.error);
  const errorOrigin = useOrchestraStore(state => state.errorOrigin);
  const reset = useOrchestraStore(state => state.reset);

  useEffect(() => {
    if (!error) return;
    track(TRACKING_EVENTS.ORCHESTRA_ERROR_VIEWED, {
      error_code: error.code,
      error_action: error.action,
      error_status: error.status,
      error_message: error.rawMessage,
    });
  }, [error]);

  const close = () => {
    reset();
    setModal(DEPOSIT_MODAL.CLOSE);
  };

  const retry = () => {
    track(TRACKING_EVENTS.ORCHESTRA_ERROR_ACTION_PRESSED, {
      error_code: error?.code,
      error_action: error?.action,
    });
    setModal(errorOrigin ?? DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT);
  };

  const canRetry = error == null || error.action === 'retry' || error.action === 'adjust_amount';

  return (
    <View className="flex-1 items-center gap-6 px-1 pt-2">
      <View className="items-center justify-center rounded-full bg-card p-6">
        <AlertCircle size={44} color="#F87171" />
      </View>
      <View className="items-center gap-2">
        <Text className="text-center text-2xl font-bold text-primary">
          {error ? orchestraErrorTitle(error) : 'Something went wrong'}
        </Text>
        <Text className="text-center text-base text-muted-foreground">
          {error?.message ??
            'We couldn’t start this deposit. Nothing was charged — please try again.'}
        </Text>
      </View>

      <View className="mt-auto w-full gap-3">
        {canRetry ? (
          <Button className="h-14 rounded-full" variant="brand" onPress={retry}>
            <Text className="text-base font-bold text-primary-foreground">
              {error?.action === 'adjust_amount' ? 'Change amount' : 'Try again'}
            </Text>
          </Button>
        ) : null}
        <Button className="h-12 rounded-full" variant="ghost" onPress={close}>
          <Text className="text-base font-semibold text-muted-foreground">Close</Text>
        </Button>

        <NeedHelp />
      </View>
    </View>
  );
};

export default OrchestraError;
