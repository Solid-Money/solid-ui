import { Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';

import {
  DEPOSIT_TOKEN_WARNING,
  RHINO_OUTSIDE_LIMITS_WARNING,
  type RhinoDepositDetailsProps,
} from '@/components/DepositOption/RhinoDeposit/RhinoDepositDetails';
import { WALLET_DEPOSIT_LEARN_URL } from '@/components/DepositOption/WalletDepositAddress/constants';
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { describeRhinoArrival, formatRhinoUsdLimits, getRhinoChainNote } from '@/lib/rhinoDeposit';

type DepositAddressInstructionsProps = {
  tokenSymbol: string;
  chainName: string;
  summary: string;
  limits?: string;
  amountWarning?: string;
  arrival?: string;
  onLearnMore: () => void;
  warningAnalyticsContext?: string;
};

const DepositAddressInstructions = ({
  tokenSymbol,
  chainName,
  summary,
  limits,
  amountWarning,
  arrival,
  onLearnMore,
  warningAnalyticsContext = 'wallet_deposit_warning',
}: DepositAddressInstructionsProps) => {
  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

  return (
    <Dialog className="gap-y-2">
      <View className="flex-row items-center justify-center gap-x-1.5 px-4">
        <Text className="min-w-0 shrink text-center text-[16px] font-semibold leading-[22px] text-white">
          {`Send only ${tokenSymbol} on ${chainName}`}
        </Text>
        <DialogTrigger asChild>
          <Pressable
            accessibilityLabel="Deposit details"
            hitSlop={13}
            className="h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#3A3A3A] web:hover:opacity-80"
            onPress={() =>
              track(TRACKING_EVENTS.TOOLTIP_OPENED, {
                context: warningAnalyticsContext,
                tooltip_text: DEPOSIT_TOKEN_WARNING.substring(0, 50),
              })
            }
          >
            <Text
              allowFontScaling={false}
              className="text-[11px] font-semibold leading-[14px] text-white/80"
            >
              ?
            </Text>
          </Pressable>
        </DialogTrigger>
      </View>
      {summary ? (
        <Text className="px-4 text-center text-[14px] leading-5 text-white/70">{summary}</Text>
      ) : null}

      <DialogContent
        webPresentation="bottom-sheet"
        nativePresentation="bottom-sheet"
        className="max-md:max-w-full max-md:rounded-b-none max-md:rounded-t-[30px] md:max-w-md"
        style={{ paddingBottom: Math.max(bottom, 24) }}
        showCloseButton={false}
      >
        <View className="min-h-10 flex-row items-center">
          <DialogTitle className="flex-1 pr-12">Deposit details</DialogTitle>
          <DialogCloseButton
            accessibilityLabel="Close deposit details"
            className="absolute right-0"
          />
        </View>
        <ScrollView style={{ maxHeight: height * 0.6 }} contentContainerClassName="gap-y-3">
          <DialogDescription className="text-sm leading-5 text-white/70">
            {DEPOSIT_TOKEN_WARNING}
          </DialogDescription>
          {limits ? <Text className="text-sm font-medium text-white">{limits}</Text> : null}
          {amountWarning ? <Text className="text-sm text-white/70">{amountWarning}</Text> : null}
          {arrival ? <Text className="text-sm text-white/70">{arrival}</Text> : null}
          <Pressable
            accessibilityRole="link"
            {...(Platform.OS === 'web' && { href: WALLET_DEPOSIT_LEARN_URL })}
            className="min-h-11 flex-row items-center gap-x-1 self-start web:hover:opacity-70"
            onPress={event => {
              if (Platform.OS === 'web') event.preventDefault();
              onLearnMore();
            }}
          >
            <Text className="text-sm font-medium text-white">Learn about deposits</Text>
            <ChevronRight color="white" size={16} />
          </Pressable>
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
};

export const RhinoWalletDepositInstructions = ({
  tokenSymbol,
  chain,
  chainName,
  destinationType,
  receiveSymbol,
  receiveChainId,
  minimumUsd,
  maximumUsd,
  onLearnMore,
}: RhinoDepositDetailsProps & { onLearnMore: () => void }) => {
  const limits = formatRhinoUsdLimits(minimumUsd, maximumUsd);
  const chainNote = getRhinoChainNote(chain);
  const receiveNetwork = receiveChainId ? getBridgeChain(receiveChainId)?.name : undefined;
  const conversion =
    receiveSymbol && receiveSymbol !== tokenSymbol
      ? `Arrives as ${receiveSymbol}${receiveNetwork ? ` on ${receiveNetwork}` : ''}`
      : '';
  const summary = [conversion, formatRhinoUsdLimits(minimumUsd)].filter(Boolean).join(' · ');
  const arrival = receiveSymbol
    ? describeRhinoArrival({ tokenSymbol, receiveSymbol, receiveChainId, destinationType })
    : undefined;

  return (
    <View className="gap-y-2">
      <DepositAddressInstructions
        tokenSymbol={tokenSymbol}
        chainName={chainName}
        summary={summary}
        limits={limits ? `${limits} per deposit` : undefined}
        amountWarning={limits ? RHINO_OUTSIDE_LIMITS_WARNING : undefined}
        arrival={arrival}
        onLearnMore={onLearnMore}
        warningAnalyticsContext="rhino_deposit_warning"
      />
      {chainNote ? <Text className="text-center text-sm text-white/70">{chainNote}</Text> : null}
    </View>
  );
};

export default DepositAddressInstructions;
