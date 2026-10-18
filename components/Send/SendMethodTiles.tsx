import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCashoutEntry } from '@/hooks/useCashout';
import { useHasFeature } from '@/hooks/useFeatureAccess';
import { useTransfiCountryAvailability } from '@/hooks/useTransfiCountryAvailability';
import { track } from '@/lib/analytics';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';

const ICONS = {
  usdc: require('@/assets/images/send/usdc.svg'),
  usdt: require('@/assets/images/send/usdt.svg'),
  eth: require('@/assets/images/send/eth.svg'),
  ng: require('@/assets/images/send/ng.svg'),
  br: require('@/assets/images/send/br.svg'),
  eu: require('@/assets/images/send/eu.svg'),
  us: require('@/assets/images/send/us.svg'),
};

const SHOW_ADDITIONAL_METHODS = false;

function IconStack({ icons }: { icons: (keyof typeof ICONS)[] }) {
  return (
    <View className="flex-row items-center">
      {icons.map((icon, index) => (
        <View
          key={icon}
          className={
            ['ng', 'br', 'eu', 'us'].includes(icon)
              ? 'overflow-hidden rounded-full border-[2.5px] border-card'
              : undefined
          }
          style={{ width: 30, height: 30, marginLeft: index ? -8 : 0 }}
        >
          <Image
            source={ICONS[icon]}
            contentFit="contain"
            style={
              icon === 'usdt'
                ? { width: 33, height: 33, left: -1.5, top: -1.5 }
                : ['ng', 'br', 'eu', 'us'].includes(icon)
                  ? { width: 30, height: 30, position: 'absolute', left: -2.5, top: -2.5 }
                  : { width: 30, height: 30 }
            }
          />
        </View>
      ))}
    </View>
  );
}

interface MethodTileProps {
  title: string;
  description: string;
  badge?: string;
  icons: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  hint?: string;
  loading?: boolean;
}

function MethodTile({
  title,
  description,
  badge,
  icons,
  onPress,
  disabled,
  hint,
  loading,
}: MethodTileProps) {
  const { width } = useWindowDimensions();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, description, badge].filter(Boolean).join('. ')}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      className="min-h-[138px] min-w-0 flex-1 justify-between gap-4 rounded-[20px] bg-card pb-[14px] pl-4 pr-[14px] pt-4 active:opacity-80 web:transition-colors web:enabled:hover:bg-card-hover"
    >
      <View className="gap-[3px]">
        <Text className="text-[17px] font-semibold leading-[21px] text-white">{title}</Text>
        <Text className="text-[13px] leading-[18px] text-white/55">{description}</Text>
      </View>
      <View className="flex-row flex-wrap items-center justify-between gap-y-2">
        {icons}
        {(badge || loading) && (
          <View className="rounded-full bg-[#333333] px-2 py-[3px]">
            {loading ? (
              <ActivityIndicator size="small" color="#FFD151" />
            ) : (
              <Text
                className="font-medium text-white/85"
                style={{ fontSize: width < 400 ? 11 : 13, lineHeight: 16 }}
              >
                {badge}
              </Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function SendMethodTiles() {
  const setModal = useSendStore(state => state.setModal);
  const hasCashout = useHasFeature('cashout');
  const { isAvailable, isResolving } = useTransfiCountryAvailability();
  const { startCashout, isChecking } = useCashoutEntry();
  const resetCashout = useCashoutStore(state => state.reset);

  return (
    <View className="gap-4">
      <Text className="px-0.5 pt-1 text-[16px] font-medium text-white/70">Choose how to send</Text>
      <View className="flex-row items-stretch gap-3">
        <MethodTile
          title="Crypto"
          description="USDC, USDT, ETH and more..."
          badge="~2 min"
          icons={<IconStack icons={['usdc', 'usdt', 'eth']} />}
          onPress={() => setModal(SEND_MODAL.OPEN_SEND_SEARCH)}
        />
        <MethodTile
          title="Local payout"
          description="Bank or mobile money in your currency"
          icons={<IconStack icons={['ng', 'br']} />}
          disabled={!hasCashout || !isAvailable}
          hint={
            !hasCashout
              ? 'Local payouts are not enabled on your account yet.'
              : !isAvailable
                ? 'Local payouts are not available in your country.'
                : undefined
          }
          loading={isChecking || isResolving}
          onPress={() => {
            track(TRACKING_EVENTS.CASH_OUT_STARTED);
            resetCashout();
            void startCashout();
          }}
        />
      </View>
      {SHOW_ADDITIONAL_METHODS && (
        <View className="flex-row items-stretch gap-3">
          <MethodTile
            title="Bank transfer"
            description="EUR by SEPA · USD by ACH"
            badge="1–3 days"
            icons={<IconStack icons={['eu', 'us']} />}
            onPress={() => setModal(SEND_MODAL.OPEN_BANK_TRANSFER)}
          />
          <MethodTile
            title="Pay anyone"
            description="@tag, or a link for anyone"
            badge="Coming soon"
            disabled
            icons={
              <View className="flex-row items-center">
                <View className="h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-background bg-card">
                  <Image
                    source={require('@/assets/images/send/solid.svg')}
                    style={{ width: 15.7265, height: 18, opacity: 0.85 }}
                  />
                </View>
                <View className="-ml-2 h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-card bg-popover">
                  <Image
                    source={require('@/assets/images/send/link.svg')}
                    style={{ width: 15, height: 15 }}
                  />
                </View>
              </View>
            }
          />
        </View>
      )}
    </View>
  );
}
