import { useCallback, useMemo } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CircleAlert, X } from 'lucide-react-native';

import ErrorRefChip from '@/components/FailureSheet/ErrorRefChip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { useSupportChatEnabled } from '@/hooks/useSupportChat';
import { track } from '@/lib/analytics';
import { clampText, ERROR_COPY_LIMITS } from '@/lib/errors/copyLimits';
import { buildSupportContext, buildSupportMessage } from '@/lib/errors/supportMessage';
import { useIntercom } from '@/lib/intercom';
import { cn } from '@/lib/utils';
import {
  closeFailureSheet,
  FailureSheetContent,
  useFailureSheetStore,
} from '@/store/useFailureSheetStore';
import { useSupportChatStore } from '@/store/useSupportChatStore';

/** Same pause the support drawer leaves between closing and opening the chat. */
const ACTION_DELAY_MS = 220;
const MAX_SHEET_WIDTH = 480;
const DIALOG_WIDTH = 440;

interface FailureBodyProps {
  content: FailureSheetContent;
  isDialog: boolean;
}

const FailureBody = ({ content, isDialog }: FailureBodyProps) => {
  const intercom = useIntercom();
  const nativeChat = useSupportChatEnabled();
  const { report } = content;
  // A transaction that may already be out must not be sent again from here.
  const mayHaveGoneOut = content.nothingSent === false;

  const analytics = useMemo(
    () => ({ error_ref: report?.ref, error_code: content.code, error_action: content.action }),
    [report?.ref, content.code, content.action],
  );

  const handlePrimary = useCallback(() => {
    closeFailureSheet();
    if (mayHaveGoneOut) {
      router.push(path.ACTIVITY);
      return;
    }
    track(TRACKING_EVENTS.ERROR_RETRY_PRESSED, analytics);
    // Closing alone is a retry for flows whose form stays open underneath.
    if (content.onRetry) setTimeout(content.onRetry, ACTION_DELAY_MS);
  }, [analytics, content.onRetry, mayHaveGoneOut]);

  const handleSupport = useCallback(() => {
    track(TRACKING_EVENTS.ERROR_SUPPORT_PRESSED, analytics);
    const message = buildSupportMessage(content.action, report, content.details);
    closeFailureSheet();
    setTimeout(() => {
      if (nativeChat) {
        // The in-house chat takes the failure as a card the server resolves
        // (Solid AI and the agent inbox read it by its event ID), not a draft.
        useSupportChatStore
          .getState()
          .setDraftContext(report ? buildSupportContext(content.title, report) : null);
        router.push(path.SUPPORT);
        return;
      }
      if (report) {
        // Also on the Intercom contact, for whoever picks up the conversation.
        intercom?.update({
          customAttributes: {
            last_error_ref: report.ref,
            last_error_event_id: report.eventId,
            last_error_action: content.action,
            last_error_code: content.code,
            last_error_at: report.occurredAt.toISOString(),
          },
        });
      }
      intercom?.showNewMessage(message);
    }, ACTION_DELAY_MS);
  }, [
    analytics,
    content.action,
    content.code,
    content.details,
    content.title,
    intercom,
    nativeChat,
    report,
  ]);

  const primaryLabel = mayHaveGoneOut
    ? 'View activity'
    : clampText(content.retryLabel ?? 'Try again', ERROR_COPY_LIMITS.buttonLabel);

  return (
    <View className="w-full items-center gap-3.5">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,101,102,0.14)]">
        <CircleAlert size={30} color="#FF6566" strokeWidth={2} />
      </View>
      <DialogTitle className="native:text-[22px] w-full text-center text-[22px] font-semibold leading-[30px] tracking-normal text-white">
        {clampText(content.title, ERROR_COPY_LIMITS.sheetTitle)}
      </DialogTitle>
      <DialogDescription className="native:text-base w-full text-center text-base leading-[22px] text-white/70">
        {clampText(content.body, ERROR_COPY_LIMITS.sheetBody)}
      </DialogDescription>
      <View className="h-1.5" />
      <Button
        variant="brand"
        className="native:h-12 h-12 w-full rounded-full"
        onPress={handlePrimary}
        accessibilityRole="button"
      >
        <Text className="text-base font-bold leading-[22px] text-black">{primaryLabel}</Text>
      </Button>
      <Pressable
        accessibilityRole="button"
        onPress={handleSupport}
        className="py-1 active:opacity-70 web:hover:opacity-80"
      >
        <Text className="text-base font-medium leading-[22px] text-white">Contact support</Text>
      </Pressable>
      {report ? <ErrorRefChip errorRef={report.ref} analytics={analytics} /> : null}
      {isDialog ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={closeFailureSheet}
          hitSlop={10}
          // 21px from the dialog's right edge and 19px from its top, measured
          // from inside its 28/36px padding.
          className="absolute -right-[7px] -top-[17px] h-5 w-5 items-center justify-center rounded-full web:hover:bg-white/10"
        >
          <X size={20} color="rgba(255, 255, 255, 0.6)" />
        </Pressable>
      ) : null}
    </View>
  );
};

/**
 * The failure sheet: a bottom sheet on phones, a centred 440px dialog from
 * `md` up (Figma: 6 Failure sheet · Web: failure dialog). Opened through
 * `showFailureSheet`; mounted once in `DeferredModalProviders`.
 */
const FailureSheetProvider = () => {
  const isOpen = useFailureSheetStore(state => state.isOpen);
  const content = useFailureSheetStore(state => state.content);
  const { isScreenMedium } = useDimension();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const handleOpenChange = (open: boolean) => {
    if (!open) closeFailureSheet();
  };

  if (!content) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
        <FailureBody content={content} isDialog={isScreenMedium} />
      </DialogContent>
    </Dialog>
  );
};

export default FailureSheetProvider;
