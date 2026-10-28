import { useEffect, useRef } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Fuel } from 'lucide-react-native';
import { formatUnits } from 'viem';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { makeNativePriceFetcher } from '@/hooks/useNativePriceUsd';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { formatNativeAmount } from '@/lib/utils/userOperation';
import { NetworkFeeRequest, useNetworkFeeStore } from '@/store/useNetworkFeeStore';

const MAX_SHEET_WIDTH = 480;
const DIALOG_WIDTH = 440;

const trackingProps = (request: NetworkFeeRequest) => ({
  chain_id: request.chainId,
  max_fee: formatUnits(request.maxFee, request.decimals),
  symbol: request.symbol,
});

const FeeBody = ({ request }: { request: NetworkFeeRequest }) => {
  const answer = useNetworkFeeStore(state => state.answer);
  // Best effort: without a price the sheet still says it in the gas token.
  const { data: price } = useQuery({
    queryKey: ['networkFeeNativePrice', request.chainId],
    queryFn: makeNativePriceFetcher(request.chainId),
    staleTime: 60_000,
  });

  const amount = formatNativeAmount(request.maxFee, request.decimals);
  const usd = Number(formatUnits(request.maxFee, request.decimals)) * Number(price);
  const usdText = Number.isFinite(usd) && usd > 0 ? ` (~$${usd.toFixed(2)})` : '';

  const respond = (accepted: boolean) => {
    track(
      accepted
        ? TRACKING_EVENTS.NETWORK_FEE_PAYMENT_ACCEPTED
        : TRACKING_EVENTS.NETWORK_FEE_PAYMENT_DECLINED,
      trackingProps(request),
    );
    answer(accepted);
  };

  return (
    <View className="w-full items-center gap-3.5">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <Fuel size={28} color="white" strokeWidth={1.75} />
      </View>
      <DialogTitle className="native:text-[22px] w-full text-center text-[22px] font-semibold leading-[30px] tracking-normal text-white">
        Pay the network fee?
      </DialogTitle>
      <DialogDescription className="native:text-base w-full text-center text-base leading-[22px] text-white/70">
        {`Network fees on ${request.network} are high right now, above what Solid covers. You can pay this one from your ${request.symbol}: up to ${amount} ${request.symbol}${usdText}. Any part not used stays in your wallet.`}
      </DialogDescription>
      <View className="h-1.5" />
      <Button
        variant="brand"
        className="native:h-12 h-12 w-full rounded-full"
        onPress={() => respond(true)}
        accessibilityRole="button"
      >
        <Text className="text-base font-bold leading-[22px] text-black">Pay fee & continue</Text>
      </Button>
      <Pressable
        accessibilityRole="button"
        onPress={() => respond(false)}
        className="py-1 active:opacity-70 web:hover:opacity-80"
      >
        <Text className="text-base font-medium leading-[22px] text-white">Cancel</Text>
      </Pressable>
    </View>
  );
};

/**
 * Asks before a transaction our paymaster won't sponsor is paid for from the
 * user's own gas token. A bottom sheet on phones, a centred dialog from `md`
 * up, styled like the failure sheet. Opened by `askToPayNetworkFee`; mounted
 * once in `DeferredModalProviders`.
 */
const NetworkFeeSheetProvider = () => {
  const isOpen = useNetworkFeeStore(state => state.isOpen);
  const request = useNetworkFeeStore(state => state.request);
  const answer = useNetworkFeeStore(state => state.answer);
  const { isScreenMedium } = useDimension();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const prompted = useRef<NetworkFeeRequest | undefined>(undefined);
  useEffect(() => {
    if (isOpen && request && prompted.current !== request) {
      prompted.current = request;
      track(TRACKING_EVENTS.NETWORK_FEE_PAYMENT_PROMPTED, trackingProps(request));
    }
  }, [isOpen, request]);

  if (!request) return null;

  return (
    <Dialog
      open={isOpen}
      // Dismissing the sheet is a no: nothing is paid without the button.
      onOpenChange={open => {
        if (!open && useNetworkFeeStore.getState().isOpen) {
          track(TRACKING_EVENTS.NETWORK_FEE_PAYMENT_DECLINED, trackingProps(request));
          answer(false);
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        webPresentation="bottom-sheet"
        nativePresentation="bottom-sheet"
        overlayClassName="bg-black/60 web:backdrop-blur-none"
        className={cn(
          'max-w-none gap-0 border border-[rgba(99,99,93,0.6)] bg-[#1A1A1A]',
          isScreenMedium
            ? 'rounded-[24px] px-7 pb-7 pt-9'
            : 'rounded-b-none rounded-t-[28px] px-4 pt-3.5',
        )}
        style={
          isScreenMedium
            ? { width: DIALOG_WIDTH, boxShadow: '0px 24px 64px rgba(0, 0, 0, 0.5)' }
            : { width: Math.min(width, MAX_SHEET_WIDTH), paddingBottom: 34 + insets.bottom }
        }
      >
        {!isScreenMedium ? (
          <View className="mb-9 h-[5px] w-[73px] self-center rounded-[3px] bg-white/30" />
        ) : null}
        <FeeBody request={request} />
      </DialogContent>
    </Dialog>
  );
};

export default NetworkFeeSheetProvider;
