import useOnramperWidget from '@/hooks/useOnramperWidget';

import { OnramperKycGate } from './OnramperKycGate';
import {
  ONRAMPER_WIDGET_HEIGHT,
  ONRAMPER_WIDGET_WIDTH,
  OnramperWidgetError,
  OnramperWidgetLoading,
  type OnramperWidgetProps,
} from './OnramperWidgetStates';

/**
 * Web: Onramper's hosted widget in an iframe.
 *
 * The `allow` list is not optional. Camera is what lets a provider capture ID
 * documents inside the frame, and payment is what lets wallet flows run. A
 * missing entry raises no error — the step just quietly does nothing, deep
 * inside a provider's flow where we have no visibility at all.
 */
const OnramperFrame = ({
  destination = 'wallet',
  shareKyc,
}: OnramperWidgetProps & { shareKyc: boolean }) => {
  const { data: session, isPending, isError, refetch } = useOnramperWidget(destination, shareKyc);

  if (isPending) return <OnramperWidgetLoading />;
  if (isError || !session) {
    return <OnramperWidgetError onRetry={() => void refetch()} />;
  }

  return (
    <iframe
      src={session.url}
      title="Buy crypto"
      height={ONRAMPER_WIDGET_HEIGHT}
      width={ONRAMPER_WIDGET_WIDTH}
      allow="accelerometer; autoplay; camera; gyroscope; payment"
      style={{
        border: 0,
        borderRadius: 16,
        maxWidth: '100%',
        alignSelf: 'center',
      }}
    />
  );
};

/** The frame, behind the upstream-KYC consent step for users it applies to. */
export const OnramperWidget = (props: OnramperWidgetProps) => (
  <OnramperKycGate>{shareKyc => <OnramperFrame {...props} shareKyc={shareKyc} />}</OnramperKycGate>
);

export default OnramperWidget;
