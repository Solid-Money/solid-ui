import { View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

/**
 * Shared UI for the payment step. The TransFi page is completed outside this
 * modal — a new tab on web, the system browser on native — so this screen only
 * explains where the user has gone and lets them come back. Both platforms
 * supply their own `onOpen`; the copy is deliberately platform-neutral.
 */
export const TransfiPaymentHandoff = ({
  onOpen,
  blocked,
}: {
  onOpen: () => void;
  /** The automatic open didn't happen (popup blocker), so lead with the button. */
  blocked?: boolean;
}) => {
  const setModal = useDepositStore(state => state.setModal);
  const amount = useTransfiStore(state => state.usdcAmount);
  const currency = useTransfiStore(state => state.fiatCurrency);

  return (
    <View className="flex-1 gap-6">
      <View className="items-center gap-4 pt-2">
        <View className="items-center justify-center rounded-full bg-card p-5">
          <ExternalLink size={40} color="#94F27F" />
        </View>
        <View className="items-center gap-2 px-4">
          <Text className="text-center text-2xl font-bold text-primary">
            {blocked ? 'Open the payment page' : 'Continue on the payment page'}
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            {blocked
              ? 'Your browser blocked the payment window. Open it to finish paying with TransFi.'
              : 'We’ve opened TransFi’s secure payment page. Finish paying there, then come back to this screen.'}
          </Text>
        </View>
      </View>

      {amount ? (
        <View className="gap-1 rounded-2xl bg-card p-5">
          <Text className="text-sm text-muted-foreground">You’re buying</Text>
          <Text className="text-lg font-bold text-primary">
            {amount} USDC{currency ? ` with ${currency}` : ''}
          </Text>
        </View>
      ) : null}

      <Text className="px-1 text-xs text-muted-foreground">
        Don’t close this window — your purchase is tracked here once TransFi confirms the payment.
      </Text>

      <View className="mt-auto gap-3">
        <Button
          className="h-14 rounded-2xl"
          variant={blocked ? 'brand' : 'secondary'}
          onPress={onOpen}
        >
          <Text
            className={
              blocked
                ? 'text-base font-bold text-primary-foreground'
                : 'text-base font-semibold text-primary'
            }
          >
            {blocked ? 'Open payment page' : 'Reopen payment page'}
          </Text>
        </Button>
        <Button
          className="h-14 rounded-2xl"
          variant={blocked ? 'secondary' : 'brand'}
          onPress={() => setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_STATUS)}
        >
          <Text
            className={
              blocked
                ? 'text-base font-semibold text-primary'
                : 'text-base font-bold text-primary-foreground'
            }
          >
            I’ve completed payment
          </Text>
        </Button>
      </View>
    </View>
  );
};

/** Shown when the order came back without a payUrl — there is nothing to open. */
export const TransfiPaymentUnavailable = () => (
  <View className="flex-1 items-center justify-center px-4">
    <Text className="text-center text-base text-red-500">
      Could not load the payment page. Please try again.
    </Text>
  </View>
);

export default TransfiPaymentHandoff;
