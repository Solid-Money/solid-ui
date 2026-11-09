import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { COUNTRIES } from '@/constants/countries';
import { path } from '@/constants/path';
import { useRainSunset } from '@/hooks/useRainSunset';
import { cardNoticeCopy, formatClosingBalance, hasClosingBalance } from '@/lib/utils/rainSunset';
import { useRainSunsetStore } from '@/store/useRainSunsetStore';

const AMBER = '#F2B544';
const GREEN = '#94F27F';

const NoticeButton = ({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={[styles.button, { backgroundColor: primary ? GREEN : '#2A2A2A' }]}
  >
    <Text
      className="text-[16px] font-semibold"
      style={{ color: primary ? '#000000' : '#FFFFFF' }}
      numberOfLines={1}
    >
      {label}
    </Text>
  </Pressable>
);

/**
 * The card-screen notice for a card that is closing (Figma "Rain closing / Card
 * notice", 30558:18018), right under the card art.
 *
 * Two versions, picked by the backend from the stored country: where the new
 * card partner serves the user, the notice offers the new card now; elsewhere
 * it says cards end in their country and offers the withdrawal. Withdraw shows
 * whenever there is money on the card; "What happens next" opens the sheet.
 */
const RainClosingCardNotice = () => {
  const router = useRouter();
  const { sunset, cardStatus, balanceUsd } = useRainSunset();
  const openSheet = useRainSunsetStore(state => state.setSheetOpen);

  if (!sunset?.notice || !sunset.hasRainCard) return null;

  const countryName = COUNTRIES.find(
    country => country.code === cardStatus?.country?.toUpperCase(),
  )?.name;
  const { title, message } = cardNoticeCopy(sunset, balanceUsd, countryName);
  const hasBalance = hasClosingBalance(balanceUsd);
  const withdrawLabel = `Withdraw ${formatClosingBalance(balanceUsd ?? 0)}`;

  const goToNewCard = () => router.push(path.CARD_NEW_CARD);
  const goToWithdraw = () => router.push(path.CARD_CLOSING_WITHDRAW);

  return (
    <View style={styles.notice}>
      <View style={styles.heading}>
        <View style={styles.icon}>
          <Clock size={20} color={AMBER} />
        </View>
        <View style={styles.titles}>
          <Text className="text-[13px] font-semibold" style={{ color: AMBER }}>
            Card closing
          </Text>
          <Text className="text-[18px] font-semibold leading-[24px] text-white">{title}</Text>
        </View>
      </View>
      <Text className="text-[15px] leading-[21px] text-white/70">{message}</Text>
      <View style={styles.buttons}>
        {sunset.newCardAvailable ? (
          <>
            <NoticeButton
              label={sunset.migration ? 'Continue to your new card' : 'Get your new card'}
              primary
              onPress={goToNewCard}
            />
            {hasBalance ? (
              <NoticeButton label={withdrawLabel} primary={false} onPress={goToWithdraw} />
            ) : (
              <NoticeButton
                label="What happens next"
                primary={false}
                onPress={() => openSheet(true)}
              />
            )}
          </>
        ) : (
          <>
            {hasBalance ? (
              <NoticeButton label={withdrawLabel} primary onPress={goToWithdraw} />
            ) : null}
            <NoticeButton
              label="What happens next"
              primary={!hasBalance}
              onPress={() => openSheet(true)}
            />
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  notice: {
    gap: 14,
    padding: 20,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(242,181,68,0.45)',
    backgroundColor: '#1C1C1C',
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242,181,68,0.14)',
  },
  titles: { flex: 1, gap: 2 },
  buttons: { gap: 8, paddingTop: 4 },
  button: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RainClosingCardNotice;
