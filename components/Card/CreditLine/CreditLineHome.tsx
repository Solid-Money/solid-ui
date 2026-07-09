import { ActivityIndicator, View } from 'react-native';

import CreditLineIntro from './CreditLineIntro';
import CreditLinePosition from './CreditLinePosition';
import { useCreditLine } from './useCreditLine';

/**
 * Entry screen for the credit line modal. Routes to the active-position
 * overview when the user is already borrowing, otherwise the intro.
 */
export default function CreditLineHome() {
  const { hasPosition, isLoading } = useCreditLine();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-24">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  return hasPosition ? <CreditLinePosition /> : <CreditLineIntro />;
}
