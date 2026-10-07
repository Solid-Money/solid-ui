import { ActivityIndicator, Pressable, View } from 'react-native';
import { ChevronRight, Landmark } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCashoutEntry } from '@/hooks/useCashout';
import { useHasFeature } from '@/hooks/useFeatureAccess';
import { useTransfiCountryAvailability } from '@/hooks/useTransfiCountryAvailability';
import { track } from '@/lib/analytics';
import { useCashoutStore } from '@/store/useCashoutStore';

/**
 * "Bank or mobile money" at the top of Send search — the way into cash-out.
 *
 * Hidden unless the user is on the feature whitelist (everyone on qa) and
 * TransFi serves their country: it runs through TransFi, and a row that
 * dead-ends in "not available here" is worse than no row. Order creation
 * refuses a non-whitelisted user too, so this hides nothing the server allows.
 */
export const CashoutEntryRow = () => {
  const hasCashout = useHasFeature('cashout');
  const { isAvailable } = useTransfiCountryAvailability();
  const { startCashout, isChecking } = useCashoutEntry();
  const resetCashout = useCashoutStore(state => state.reset);

  if (!hasCashout || !isAvailable) return null;

  const handlePress = () => {
    track(TRACKING_EVENTS.CASH_OUT_STARTED);
    resetCashout();
    void startCashout();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cash out to a bank account or mobile money"
      onPress={handlePress}
      disabled={isChecking}
      className="flex-row items-center gap-3 rounded-2xl bg-card p-4 web:transition-colors web:hover:bg-card-hover"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-foreground/10">
        <Landmark size={20} color="white" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold">Bank or mobile money</Text>
        <Text className="text-sm opacity-50">Cash out in your local currency</Text>
      </View>
      {isChecking ? (
        <ActivityIndicator size="small" color="#94F27F" />
      ) : (
        <ChevronRight size={20} color="white" />
      )}
    </Pressable>
  );
};

export default CashoutEntryRow;
