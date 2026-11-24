import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';

import { WirexOnboardingLayout } from '@/components/Card/WirexOnboarding/WirexOnboardingLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { COUNTRIES } from '@/constants/countries';
import { path } from '@/constants/path';
import { useRainSunset } from '@/hooks/useRainSunset';
import { getAsset } from '@/lib/assets';
import {
  closedCardCopy,
  formatClosingBalance,
  hasClosingBalance,
  isClosingBalanceUnknown,
} from '@/lib/utils/rainSunset';

/**
 * The card the Rain sunset closed: why it no longer works, the way to whatever
 * was left on it, and the way to the new card where there is one.
 *
 * Without this screen a closed card reads as "no card": the card flow offered
 * to activate it, and the card screen drew it as if it still worked. Reached
 * from `/card`, the activate screen, Home's card and the closed-card banner.
 */
export function RainCardClosedScreen() {
  const router = useRouter();
  const { sunset, cardStatus, isLoading, balanceUsd, isBalanceLoading } = useRainSunset();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  // Not (or no longer) a closed card — moved to the new card, say: the card
  // flow knows where they belong.
  if (!sunset?.cardClosed) return <Redirect href={path.CARD} />;

  const countryName = COUNTRIES.find(
    country => country.code === cardStatus?.country?.toUpperCase(),
  )?.name;
  const { title, message } = closedCardCopy(sunset, balanceUsd, countryName);
  // A read that failed still offers the withdrawal (its screen re-reads); one
  // still in flight waits rather than flashing a button that may go away.
  const balanceUnknown = isClosingBalanceUnknown(balanceUsd);
  const hasBalance = hasClosingBalance(balanceUsd) || (balanceUnknown && !isBalanceLoading);
  const newCard = sunset.newCardAvailable || Boolean(sunset.migration);

  const goHome = () => router.replace(path.HOME);

  return (
    <WirexOnboardingLayout
      onBack={goHome}
      footer={
        <View style={styles.buttons}>
          {hasBalance ? (
            <Button
              variant="brand"
              className="h-[54px] w-full rounded-full"
              onPress={() => router.push(path.CARD_CLOSING_WITHDRAW)}
            >
              <Text className="text-[17px] font-semibold text-black">
                {balanceUnknown
                  ? 'Withdraw card balance'
                  : `Withdraw ${formatClosingBalance(balanceUsd ?? 0)}`}
              </Text>
            </Button>
          ) : null}
          {newCard ? (
            <Button
              variant={hasBalance ? undefined : 'brand'}
              className={`h-[54px] w-full rounded-full ${hasBalance ? 'bg-white' : ''}`}
              onPress={() => router.push(path.CARD_NEW_CARD)}
            >
              <Text className="text-[17px] font-semibold text-black">
                {sunset.migration ? 'Continue to your new card' : 'Get your new card'}
              </Text>
            </Button>
          ) : null}
          {!hasBalance && !newCard ? (
            <Button className="h-[54px] w-full rounded-full bg-white" onPress={goHome}>
              <Text className="text-[17px] font-semibold text-black">Back to home</Text>
            </Button>
          ) : null}
        </View>
      }
    >
      <View className="items-center gap-5">
        <Image
          source={getAsset('images/card-closing-art.svg')}
          style={styles.art}
          contentFit="contain"
        />
        <View className="w-full gap-2">
          <Text className="text-center text-[28px] font-semibold leading-[34px] text-white">
            {title}
          </Text>
          <Text className="text-center text-[15px] leading-[21px] text-white/70">{message}</Text>
        </View>
      </View>
    </WirexOnboardingLayout>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111111' },
  buttons: { gap: 10 },
  art: { width: 120, height: 120 },
});
