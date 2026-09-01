import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, RotateCw } from 'lucide-react-native';

import MerchantBadge from '@/components/Card/ThreeDs/MerchantBadge';
import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { cardThreeDsRequestPath, path } from '@/constants/path';
import { useWirexThreeDs } from '@/hooks/useWirexThreeDs';
import { CardProvider, WirexThreeDsRequest } from '@/lib/types';
import { formatCardAmount } from '@/lib/utils/cardHelpers';

/** How often to re-read the list while this screen is open. */
const POLL_MS = 15_000;

/**
 * Every 3D Secure challenge waiting on the cardholder.
 *
 * This screen exists because the push cannot be trusted to arrive. Wirex gives a
 * webhook 10 seconds and "logs but does not automatically retry" a delivery that
 * fails, so a challenge whose push was missed is invisible — and invisible means
 * the payment fails at the terminal with nothing the user can do about it. Here
 * they can find it and answer it.
 *
 * It polls as well as offering the refresh the user asked for: a challenge that
 * arrives while this screen is open should show up on its own.
 */
export default function ThreeDsRequests() {
  const router = useRouter();
  const { requests, isLoading, isFetching, isError, refetch, isSupported } = useWirexThreeDs({
    pollMs: POLL_MS,
  });

  const openRequest = (request: WirexThreeDsRequest) =>
    router.push(
      cardThreeDsRequestPath(request.transactionId, {
        amount: request.amount,
        currency: request.currency,
        merchantName: request.merchantName,
        cardLast4: request.cardLast4,
      }),
    );

  return (
    <PageLayout desktopOnly isLoading={isLoading && isSupported}>
      <View className="mx-auto w-full max-w-[600px] flex-1 px-4 pt-8">
        <View className="mb-8 flex-row items-center justify-between px-4">
          <BackButton fallbackHref={path.CARD_DETAILS} />
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Payment approvals
          </Text>
          <Pressable
            accessibilityLabel="Refresh"
            accessibilityRole="button"
            onPress={() => refetch()}
            className="h-[50px] w-[50px] items-center justify-center web:hover:opacity-70"
          >
            {isFetching ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <RotateCw color="white" size={22} />
            )}
          </Pressable>
        </View>

        <Text className="mb-6 px-4 text-center text-sm text-muted-foreground">
          Some merchants ask you to confirm a payment before it goes through. Anything waiting on
          you shows up here.
        </Text>

        <ThreeDsRequestsBody
          isSupported={isSupported}
          isError={isError}
          requests={requests}
          onSelect={openRequest}
        />
      </View>
    </PageLayout>
  );
}

interface BodyProps {
  isSupported: boolean;
  isError: boolean;
  requests: WirexThreeDsRequest[];
  onSelect: (request: WirexThreeDsRequest) => void;
}

const ThreeDsRequestsBody = ({ isSupported, isError, requests, onSelect }: BodyProps) => {
  if (!isSupported) {
    return <EmptyMessage text="Your card doesn't use payment approvals." />;
  }
  if (isError) {
    return <EmptyMessage text="Couldn't load your approvals. Try the refresh button above." />;
  }
  if (!requests.length) {
    return <EmptyMessage text="No payments waiting for approval." />;
  }

  return (
    <View className="overflow-hidden rounded-twice bg-card">
      {requests.map((request, index) => (
        <RequestRow
          key={request.transactionId}
          request={request}
          isLast={index === requests.length - 1}
          onPress={() => onSelect(request)}
        />
      ))}
    </View>
  );
};

const EmptyMessage = ({ text }: { text: string }) => (
  <View className="items-center px-4 py-10">
    <Text className="text-center text-muted-foreground">{text}</Text>
  </View>
);

interface RequestRowProps {
  request: WirexThreeDsRequest;
  isLast: boolean;
  onPress: () => void;
}

const RequestRow = ({ request, isLast, onPress }: RequestRowProps) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    className={`flex-row items-center justify-between p-4 web:hover:bg-card-hover ${
      isLast ? '' : 'border-b border-white/10'
    }`}
  >
    <View className="mr-2 flex-1 flex-row items-center gap-3">
      <MerchantBadge name={request.merchantName} />
      <View className="flex-1">
        <Text className="text-base font-medium text-white" numberOfLines={1}>
          {request.merchantName}
        </Text>
        <Text className="text-sm text-muted-foreground">Card •••• {request.cardLast4}</Text>
      </View>
    </View>
    <View className="shrink-0 flex-row items-center gap-2">
      <Text className="font-bold text-white">
        {formatCardAmount(request.amount, CardProvider.WIREX, request.currency)}
      </Text>
      <ChevronRight color="#8F8F8F" size={18} />
    </View>
  </Pressable>
);
